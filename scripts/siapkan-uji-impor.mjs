// Siapkan paket uji impor Coretax dengan identitas nyata milik mitra uji. Dua bagian, boleh salah satu atau keduanya:
//
//  1. Faktur pajak keluaran: 10 kasus dari fixtures/faktur-keluaran/golden/kasus.json
//       --npwp-penjual 16digit --nitku-penjual 22digit [--npwp-pembeli ... --nitku-pembeli ...] [--nik ...] [--tanggal 2026-11-05]
//  2. Retur faktur pajak masukan: dari file JSON yang diisi mitra berdasarkan faktur masukan yang SUDAH ADA di akunnya
//       --retur retur-mitra.json   (contoh: fixtures/retur-masukan/contoh-uji-impor.json)
//
// Pemakaian (setelah `pnpm build`): node scripts/siapkan-uji-impor.mjs <opsi> [--keluar uji-impor-keluar]
// Hasil: satu XML per kasus (+ semua.xml / retur-semua.xml) dan lembar-hasil.md. Berisi identitas nyata: jangan di-commit.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const dist = fileURLToPath(new URL('../packages/core/dist/index.js', import.meta.url))
if (!existsSync(dist)) {
  console.error('Belum ada packages/core/dist. Jalankan `pnpm build` dulu.')
  process.exit(1)
}
const { fakturKeluaran, returMasukan } = await import(`file://${dist.replaceAll('\\', '/')}`)

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
    retur: { type: 'string' },
    keluar: { type: 'string', default: 'uji-impor-keluar' },
  },
})
const adaFaktur = Boolean(a['npwp-penjual'] || a['nitku-penjual'])
if (adaFaktur && !(a['npwp-penjual'] && a['nitku-penjual'])) {
  console.error('Faktur keluaran butuh --npwp-penjual (16 digit) dan --nitku-penjual (22 digit) sekaligus.')
  process.exit(1)
}
if (!adaFaktur && !a.retur) {
  console.error(
    'Beri --npwp-penjual dan --nitku-penjual (faktur keluaran), dan/atau --retur <file.json> (retur masukan). Lihat docs/UJI-IMPOR.md.',
  )
  process.exit(1)
}

mkdirSync(a.keluar, { recursive: true })
const peringatan = []
const bagian = []
const slug = (s) =>
  s
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

// ---------- 1. Faktur pajak keluaran ----------
let jumlahFaktur = 0
if (adaFaktur) {
  const kasus = JSON.parse(
    readFileSync(new URL('../fixtures/faktur-keluaran/golden/kasus.json', import.meta.url), 'utf8'),
  )
  const penjual = { npwp: a['npwp-penjual'], nitku: a['nitku-penjual'] }
  // Tanpa --npwp-pembeli, pembeli = penjual sendiri (seperti sampel resmi DJP). Lebih baik pakai pembeli lain yang terdaftar.
  const pembeliTin = { npwp: a['npwp-pembeli'] ?? penjual.npwp, nitku: a['nitku-pembeli'] ?? penjual.nitku }
  const baris = []
  const semua = []
  kasus.faktur.forEach((f, i) => {
    const salin = structuredClone(f)
    if (a.tanggal) salin.tanggal = a.tanggal
    if (salin.pembeli.jenisId === 'TIN') Object.assign(salin.pembeli, pembeliTin)
    if (salin.pembeli.jenisId === 'National ID' && a.nik) salin.pembeli.nomorDokumen = a.nik
    const nomor = String(i + 1).padStart(2, '0')
    const nama = `${nomor}-kode${f.kodeTransaksi}${slug((f.referensi ?? '').replace(/^GOLD-\d+\s*/, '')) ? `-${slug((f.referensi ?? '').replace(/^GOLD-\d+\s*/, ''))}` : ''}.xml`
    // build melempar jika data tidak valid
    writeFileSync(
      join(a.keluar, nama),
      fakturKeluaran.build({ penjual, faktur: [salin] }, { hitung: 'strict' }),
    )
    semua.push(salin)
    baris.push(
      `| ${nomor} | ${f.kodeTransaksi} | ${f.referensi.replace(/^GOLD-\d+\s*/, '') || 'kasus dasar'} | \`${nama}\` |  |  |`,
    )
  })
  writeFileSync(
    join(a.keluar, 'semua.xml'),
    fakturKeluaran.build({ penjual, faktur: semua }, { hitung: 'strict' }),
  )
  jumlahFaktur = semua.length
  bagian.push(
    `## Faktur pajak keluaran

| # | Kode | Kasus | File | Hasil | Pesan error / catatan |
| --- | --- | --- | --- | --- | --- |
${baris.join('\n')}
| - | - | Semua ${semua.length} sekaligus | \`semua.xml\` |  |  |`,
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
    peringatan.push(
      'Tanggal faktur masih Oktober 2026. Pakai --tanggal sesuai masa pajak yang boleh diimpor.',
    )
}

// ---------- 2. Retur faktur pajak masukan ----------
let jumlahRetur = 0
if (a.retur) {
  const batch = JSON.parse(readFileSync(a.retur, 'utf8'))
  const baris = []
  const daftar = Array.isArray(batch.retur) ? batch.retur : []
  daftar.forEach((r, i) => {
    const nomor = `R${String(i + 1).padStart(2, '0')}`
    const nama = `${nomor}-retur-${slug(String(r.nomorFaktur ?? '').slice(-6)) || i + 1}.xml`
    writeFileSync(join(a.keluar, nama), returMasukan.build({ ...batch, retur: [r] }))
    baris.push(
      `| ${nomor} | ${r.nomorFaktur ? `...${String(r.nomorFaktur).slice(-6)}` : '-'} | ${(r.item ?? []).length} item | \`${nama}\` |  |  |`,
    )
  })
  const hasilSemua = returMasukan.build(batch) // juga memeriksa batch utuh; melempar jika ada yang tidak valid
  if (daftar.length > 1) writeFileSync(join(a.keluar, 'retur-semua.xml'), hasilSemua)
  jumlahRetur = daftar.length
  bagian.push(
    `## Retur faktur pajak masukan

Retur hanya bisa diimpor jika nomor faktur, penjual, dan setiap barang **sama dengan faktur masukan yang ada di akun**,
dan jumlah retur tidak melebihi saldo. Catat juga apakah Coretax menerima total dokumen dalam rupiah utuh.

| # | Faktur asal | Isi | File | Hasil | Pesan error / catatan |
| --- | --- | --- | --- | --- | --- |
${baris.join('\n')}${daftar.length > 1 ? `\n| - | - | Semua ${daftar.length} sekaligus | \`retur-semua.xml\` |  |  |` : ''}`,
  )
  peringatan.push(
    'Retur: pastikan data di file JSON diambil dari faktur masukan yang benar-benar ada, lalu hapus draf retur di Coretax setelah uji.',
  )
}

writeFileSync(
  join(a.keluar, 'lembar-hasil.md'),
  `# Lembar hasil uji impor Coretax

Tanggal uji: ........  Penguji: ........  Versi library: ........

Isi kolom **Hasil** dengan LOLOS atau DITOLAK. Untuk DITOLAK, salin pesan error Coretax **apa adanya**
(tanpa NPWP/NIK/nama; ganti dengan ***). Setelah impor berhasil, cocokkan angka DPP dan PPN yang
tampil di Coretax dengan file XML dan tulis bedanya di Catatan.

${bagian.join('\n\n')}
`,
)

const ringkas = [
  jumlahFaktur ? `${jumlahFaktur} faktur keluaran` : '',
  jumlahRetur ? `${jumlahRetur} retur masukan` : '',
]
  .filter(Boolean)
  .join(' + ')
console.log(`Selesai: ${a.keluar}/ berisi ${ringkas} (satu file XML per kasus) dan lembar-hasil.md`)
for (const p of peringatan) console.warn(`Perhatian: ${p}`)
