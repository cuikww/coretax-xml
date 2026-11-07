// Tulis errors/katalog.json: katalog kode error (template pesan id dan en, parameter, dan tingkat) untuk
// dokumentasi dan port ke bahasa lain. Pemakaian (setelah `pnpm build`): node scripts/buat-katalog-error.mjs
// CI menjalankan skrip ini lalu `git diff --exit-code errors/`: katalog yang basi menggagalkan build.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const akar = new URL('../', import.meta.url)
const dist = new URL('packages/core/dist/index.js', akar)
if (!existsSync(dist)) {
  console.error('Belum ada packages/core/dist. Jalankan `pnpm build` dulu.')
  process.exit(1)
}
const { katalogError } = await import(dist.href)
const katalog = katalogError()

// Tingkat (error atau peringatan) ditentukan di tempat kode dilaporkan, jadi dibaca dari sumber:
//   k.tambah('warning', 'KODE', ...)  -> tingkat dari argumen pertama
//   tambah('KODE', ...)               -> pemeriksa struktur XML, selalu error
const tingkat = {}
const catat = (kode, level) => {
  tingkat[kode] = tingkat[kode] ?? new Set()
  tingkat[kode].add(level)
}
// Kode yang dipilih lewat variabel, jadi tidak terlihat oleh pola di bawah. Semuanya error:
//   NPWP_FORMAT, NITKU_FORMAT  -> periksaDigit() di faktur-keluaran.ts (panjang 16 atau 22)
//   NUMBER_FORMAT, NUMBER_DECIMALS -> bacaAngka() di faktur-keluaran.ts
for (const kode of ['NPWP_FORMAT', 'NITKU_FORMAT', 'NUMBER_FORMAT', 'NUMBER_DECIMALS']) catat(kode, 'error')
const dir = fileURLToPath(new URL('packages/core/src/', akar))
for (const nama of readdirSync(dir).filter((f) => f.endsWith('.ts'))) {
  const sumber = readFileSync(dir + nama, 'utf8')
  for (const m of sumber.matchAll(/tambah\(\s*'(error|warning)'\s*,\s*'([A-Z][A-Z_]+)'/g)) catat(m[2], m[1])
  for (const m of sumber.matchAll(/tambah\(\s*'(?!error'|warning')([A-Z][A-Z_]+)'/g)) catat(m[1], 'error')
}

const hasil = {}
const tanpaTingkat = []
for (const [kode, entri] of Object.entries(katalog)) {
  const t = tingkat[kode]
  if (!t) tanpaTingkat.push(kode)
  hasil[kode] = { tingkat: t ? [...t].sort() : [], ...entri }
}
if (tanpaTingkat.length > 0) {
  console.error(`Kode error tidak pernah dilaporkan di sumber (hapus atau pakai): ${tanpaTingkat.join(', ')}`)
  process.exit(1)
}

mkdirSync(new URL('errors/', akar), { recursive: true })
writeFileSync(new URL('errors/katalog.json', akar), `${JSON.stringify(hasil, null, 2)}\n`)
console.log(`errors/katalog.json: ${Object.keys(hasil).length} kode`)
