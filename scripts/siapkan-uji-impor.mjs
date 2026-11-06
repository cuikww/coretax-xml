// Siapkan paket uji impor Coretax: 10 kasus dari kasus.json, dengan identitas nyata milik mitra uji.
// Pemakaian (setelah `pnpm build`):
//   node scripts/siapkan-uji-impor.mjs --npwp-penjual 16digit --nitku-penjual 22digit \
//     --npwp-pembeli 16digit --nitku-pembeli 22digit [--nik 16digit] [--tanggal 2026-11-05] [--keluar uji-impor-keluar]
// Hasil: satu XML per kasus + semua.xml + lembar-hasil.md. Berisi identitas nyata: jangan di-commit.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const dist = fileURLToPath(new URL('../packages/core/dist/index.js', import.meta.url))
if (!existsSync(dist)) {
  console.error('Belum ada packages/core/dist. Jalankan `pnpm build` dulu.')
  process.exit(1)
}
const { fakturKeluaran } = await import(`file://${dist.replaceAll('\\', '/')}`)

// Tampilkan error validasi sebagai daftar, bukan stack trace
process.on('uncaughtException', (e) => {
  if (!e.hasil) {
    console.error(e)
    process.exit(1)
  }
  console.error('Data tidak valid:')
  for (const x of e.hasil.errors) console.error(`- ${x.pesan}`)
  process.exit(1)
})

const { values: a } = parseArgs({
  options: {
    'npwp-penjual': { type: 'string' },
    'nitku-penjual': { type: 'string' },
    'npwp-pembeli': { type: 'string' },
    'nitku-pembeli': { type: 'string' },
    nik: { type: 'string' },
    tanggal: { type: 'string' },
    keluar: { type: 'string', default: 'uji-impor-keluar' },
  },
})
if (!a['npwp-penjual'] || !a['nitku-penjual']) {
  console.error('Wajib: --npwp-penjual (16 digit) dan --nitku-penjual (22 digit). Lihat docs/UJI-IMPOR.md.')
  process.exit(1)
}

const sumber = new URL('../fixtures/faktur-keluaran/golden/kasus.json', import.meta.url)
const kasus = JSON.parse(readFileSync(sumber, 'utf8'))
const penjual = { npwp: a['npwp-penjual'], nitku: a['nitku-penjual'] }
// Tanpa --npwp-pembeli, pembeli = penjual sendiri (seperti sampel resmi DJP). Lebih baik pakai pembeli lain yang terdaftar.
const pembeliTin = { npwp: a['npwp-pembeli'] ?? penjual.npwp, nitku: a['nitku-pembeli'] ?? penjual.nitku }

mkdirSync(a.keluar, { recursive: true })
const baris = []
const semua = []
const peringatan = []
kasus.faktur.forEach((f, i) => {
  const salin = structuredClone(f)
  if (a.tanggal) salin.tanggal = a.tanggal
  if (salin.pembeli.jenisId === 'TIN') Object.assign(salin.pembeli, pembeliTin)
  if (salin.pembeli.jenisId === 'National ID' && a.nik) salin.pembeli.nomorDokumen = a.nik
  const batch = { penjual, faktur: [salin] }
  const nomor = String(i + 1).padStart(2, '0')
  const slug = (f.referensi ?? '')
    .replace(/^GOLD-\d+\s*/, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
  const nama = `${nomor}-kode${f.kodeTransaksi}${slug ? `-${slug}` : ''}.xml`
  writeFileSync(join(a.keluar, nama), fakturKeluaran.build(batch, { hitung: 'strict' })) // melempar jika data tidak valid
  semua.push(salin)
  baris.push(
    `| ${nomor} | ${f.kodeTransaksi} | ${f.referensi.replace(/^GOLD-\d+\s*/, '') || 'kasus dasar'} | \`${nama}\` |  |  |`,
  )
})
writeFileSync(
  join(a.keluar, 'semua.xml'),
  fakturKeluaran.build({ penjual, faktur: semua }, { hitung: 'strict' }),
)

if (!a['npwp-pembeli'])
  peringatan.push(
    'Pembeli = penjual sendiri. Faktur ke diri sendiri bisa ditolak; pakai --npwp-pembeli milik pihak lain yang terdaftar.',
  )
if (!a.nik)
  peringatan.push(
    'Kasus 07 (pembeli NIK) memakai NIK rekaan dan hampir pasti ditolak. Pakai --nik dengan NIK yang valid.',
  )
if (!a.tanggal)
  peringatan.push('Tanggal faktur masih Oktober 2026. Pakai --tanggal sesuai masa pajak yang boleh diimpor.')

writeFileSync(
  join(a.keluar, 'lembar-hasil.md'),
  `# Lembar hasil uji impor Coretax

Tanggal uji: ........  Penguji: ........  Versi library: ........

Isi kolom **Hasil** dengan LOLOS atau DITOLAK. Untuk DITOLAK, salin pesan error Coretax **apa adanya**
(tanpa NPWP/NIK/nama; ganti dengan ***). Setelah impor berhasil, cocokkan angka DPP dan PPN yang
tampil di Coretax dengan file XML dan tulis bedanya di Catatan.

| # | Kode | Kasus | File | Hasil | Pesan error / catatan |
| --- | --- | --- | --- | --- | --- |
${baris.join('\n')}
| - | - | Semua 10 sekaligus | \`semua.xml\` |  |  |
`,
)

console.log(`Selesai: ${a.keluar}/ berisi ${kasus.faktur.length} file XML + semua.xml + lembar-hasil.md`)
for (const p of peringatan) console.warn(`Perhatian: ${p}`)
