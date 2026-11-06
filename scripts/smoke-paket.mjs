// Pasang tarball hasil `pnpm pack` di folder kosong, lalu pakai lewat ESM dan CJS.
// Menangkap kesalahan `files`/`exports` di package.json yang tidak terlihat oleh test di src/.
// Pemakaian: pnpm build && node scripts/smoke-paket.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const shell = process.platform === 'win32' // pnpm/npm adalah .cmd di Windows
const jalan = (cmd, args, cwd) =>
  execFileSync(cmd, args, { cwd, shell, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
const core = fileURLToPath(new URL('../packages/core', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'smoke-'))
try {
  jalan('pnpm', ['pack', '--pack-destination', tmp], core)
  const tgz = readdirSync(tmp).find((f) => f.endsWith('.tgz'))
  const app = join(tmp, 'app')
  mkdirSync(app)
  jalan('npm', ['init', '-y'], app)
  jalan('npm', ['install', '--no-audit', '--no-fund', resolve(tmp, tgz)], app)

  const batch = `{
    penjual: { npwp: '0000000000000000', nitku: '0000000000000000000000' },
    faktur: [{
      tanggal: '2026-10-01', kodeTransaksi: '04',
      pembeli: { jenisId: 'TIN', npwp: '0000000000000000', nitku: '0000000000000000000000', nama: 'A', alamat: 'B' },
      item: [{ jenis: 'jasa', nama: 'X', satuan: 'UM.0033', harga: 600000, jumlah: 2 }],
    }],
  }`
  const cek = `const xml = fakturKeluaran.build(${batch})
    if (!xml.includes('<VAT>132000</VAT>')) throw new Error('hasil build tidak sesuai')
    if (fakturKeluaran.validate(${batch}).valid !== true) throw new Error('validate gagal')`
  writeFileSync(join(app, 'esm.mjs'), `import { fakturKeluaran } from 'coretax-xml'\n${cek}\n`)
  writeFileSync(join(app, 'cjs.cjs'), `const { fakturKeluaran } = require('coretax-xml')\n${cek}\n`)
  jalan('node', ['esm.mjs'], app)
  jalan('node', ['cjs.cjs'], app)
  console.log(`Paket ${tgz}: ESM dan CJS jalan.`)
} finally {
  rmSync(tmp, { recursive: true, force: true })
}
