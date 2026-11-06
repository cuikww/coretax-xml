// Isi sheet Faktur + DetailFaktur di template Excel resmi DJP dari file JSON kasus uji.
// Pemakaian: node buat-xlsx.mjs <folder ConverterEfakturCoretax_v1.6> <kasus.json> <keluaran.xlsx>
// Semua angka (DPP, DPP nilai lain, PPN, PPnBM) diambil apa adanya dari JSON; skrip tidak menghitung.
// ponytail: pakai bsdtar untuk baca/tulis zip (Windows 10+ dan macOS); GNU tar di Linux tidak bisa.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const [folder, jsonPath, keluaran] = process.argv.slice(2)
if (!keluaran) {
  console.error(
    'Pemakaian: node buat-xlsx.mjs <folder ConverterEfakturCoretax_v1.6> <kasus.json> <keluaran.xlsx>',
  )
  process.exit(1)
}
const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar'
const batch = JSON.parse(readFileSync(jsonPath, 'utf8'))
const tmp = mkdtempSync(join(tmpdir(), 'xlsx-'))
const templat = join(folder, 'TemplateExcel', 'Sample Faktur PK Template v.1.6.1.xlsx')
execFileSync(tar, ['-xf', templat, '-C', tmp])
const baca = (p) => readFileSync(join(tmp, p), 'utf8')
const tulis = (p, s) => writeFileSync(join(tmp, p), s)

// Tabel string bersama: tambahkan string baru di belakang yang sudah ada
let sst = baca('xl/sharedStrings.xml')
const jumlahSi = sst.split('<si>').length - 1
const baru = []
const indeks = new Map()
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const str = (s) => {
  if (!indeks.has(s)) {
    indeks.set(s, jumlahSi + baru.length)
    baru.push(`<si><t xml:space="preserve">${esc(s)}</t></si>`)
  }
  return indeks.get(s)
}

const kol = (i) => String.fromCharCode(65 + i)
const gaya = (s) => (s ? ` s="${s}"` : '')
const T = (r, i, v, s) =>
  v === '' || v == null
    ? `<c r="${kol(i)}${r}"${gaya(s)}/>`
    : `<c r="${kol(i)}${r}"${gaya(s)} t="s"><v>${str(v)}</v></c>`
const N = (r, i, v, s) => `<c r="${kol(i)}${r}"${gaya(s)}><v>${v}</v></c>`
const baris = (r, sel) => `<row r="${r}">${sel.join('')}</row>`
const serial = (tgl) => {
  const [y, m, d] = tgl.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000 + 25569
}
const barisAsli = (xml, r) => new RegExp(`<row r="${r}"[\\s\\S]*?</row>`).exec(xml)?.[0] ?? ''
const NOL16 = '0000000000000000'

const fakturRows = []
const detailRows = []
batch.faktur.forEach((f, n) => {
  const r = 4 + n
  const p = f.pembeli
  const tin = p.jenisId === 'TIN'
  fakturRows.push(
    baris(r, [
      N(r, 0, n + 1, 6),
      N(r, 1, serial(f.tanggal), 7),
      T(r, 2, 'Normal', 8),
      T(r, 3, f.kodeTransaksi, 9),
      T(r, 4, f.keteranganTambahan, 9),
      T(r, 5, f.dokumenPendukung, 9),
      T(r, 6, f.periodeDokumenPendukung, 9),
      T(r, 7, f.referensi, 9),
      T(r, 8, f.capFasilitas, 9),
      T(r, 9, batch.penjual.nitku, 11),
      T(r, 10, tin ? p.npwp : NOL16, 1),
      T(r, 11, p.jenisId, 9),
      T(r, 12, p.negara ?? 'IDN', 9),
      T(r, 13, tin ? '-' : p.nomorDokumen, 9),
      T(r, 14, p.nama, 9),
      T(r, 15, p.alamat, 9),
      T(r, 16, p.email, 10),
      T(r, 17, tin ? p.nitku : '000000', 11),
    ]),
  )
  for (const it of f.item) {
    const d = 2 + detailRows.length
    detailRows.push(
      baris(d, [
        N(d, 0, n + 1),
        T(d, 1, it.jenis === 'jasa' ? 'B' : 'A'),
        T(d, 2, it.kode ?? '000000', 1),
        T(d, 3, it.nama),
        T(d, 4, it.satuan),
        N(d, 5, it.harga),
        N(d, 6, it.jumlah, 24),
        N(d, 7, it.diskon ?? 0, 23),
        N(d, 8, it.dpp, 23),
        N(d, 9, it.dppNilaiLain, 23),
        N(d, 10, it.tarifPpn ?? 12),
        N(d, 11, it.ppn, 23),
        N(d, 12, it.tarifPpnbm ?? 0),
        N(d, 13, it.ppnbm, 23),
      ]),
    )
  }
})

const ganti = (xml, sheetData, dimensi) =>
  xml
    .replace(/<sheetData>[\s\S]*<\/sheetData>/, () => `<sheetData>${sheetData}</sheetData>`)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${dimensi}"/>`)

// sheet1 = Faktur, sheet2 = DetailFaktur (urutan di workbook.xml)
const s1 = baca('xl/worksheets/sheet1.xml')
const baris1 = barisAsli(s1, 1).replace(
  /(<c r="C1"[^>]*><v>)\d+(<\/v>)/,
  (_, a, b) => `${a}${str(batch.penjual.npwp)}${b}`,
)
const akhir1 = 4 + batch.faktur.length
tulis(
  'xl/worksheets/sheet1.xml',
  ganti(
    s1,
    baris1 + barisAsli(s1, 3) + fakturRows.join('') + baris(akhir1, [T(akhir1, 0, 'END', 12)]),
    `A1:R${akhir1}`,
  ),
)
const s2 = baca('xl/worksheets/sheet2.xml')
const akhir2 = 2 + detailRows.length
tulis(
  'xl/worksheets/sheet2.xml',
  ganti(s2, barisAsli(s2, 1) + detailRows.join('') + baris(akhir2, [T(akhir2, 0, 'END')]), `A1:N${akhir2}`),
)

sst = sst
  .replace('</sst>', `${baru.join('')}</sst>`)
  .replace(/uniqueCount="\d+"/, `uniqueCount="${jumlahSi + baru.length}"`)
tulis('xl/sharedStrings.xml', sst)

// Rumus lama dibuang, jadi daftar urutan hitung (calcChain) harus ikut dibuang
rmSync(join(tmp, 'xl/calcChain.xml'))
tulis(
  '[Content_Types].xml',
  baca('[Content_Types].xml').replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, ''),
)
tulis(
  'xl/_rels/workbook.xml.rels',
  baca('xl/_rels/workbook.xml.rels').replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''),
)

execFileSync(tar, ['--format', 'zip', '-cf', resolve(keluaran), '-C', tmp, ...readdirSync(tmp)])
rmSync(tmp, { recursive: true, force: true })
console.log(`${keluaran}: ${batch.faktur.length} faktur, ${detailRows.length} baris detail`)
