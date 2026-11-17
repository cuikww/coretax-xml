// Isi sheet DATA di template Excel bukti potong resmi DJP (BP21 v.4 atau BP26) dari kasus-bp21.json / kasus-bp26.json.
// Pemakaian: node buat-xlsx.mjs <template DJP .xlsx> <kasus.json> <keluaran.xlsx>
//
// BP21: kolom Deemed dan Tarif TIDAK diisi dari JSON. Rumus baris 4 template (J, K, R sampai Z) disalin ke setiap
// baris dan file ditandai "hitung ulang saat dibuka", jadi Excel sendiri yang menghitung deemed dan tarif. Ekspor XML
// dari Excel dengan begitu menguji tabel tarif library. BP26 tidak punya rumus: deemed dan tarif diambil dari JSON.
// ponytail: pakai bsdtar untuk baca/tulis zip (Windows 10+ dan macOS); GNU tar di Linux tidak bisa.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const [templat, jsonPath, keluaran] = process.argv.slice(2)
if (!keluaran) {
  console.error('Pemakaian: node buat-xlsx.mjs <template DJP .xlsx> <kasus.json> <keluaran.xlsx>')
  process.exit(1)
}
const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'tar'
const batch = JSON.parse(readFileSync(jsonPath, 'utf8'))
const tmp = mkdtempSync(join(tmpdir(), 'xlsx-bupot-'))
execFileSync(tar, ['-xf', resolve(templat), '-C', tmp])
const baca = (p) => readFileSync(join(tmp, p), 'utf8')
const tulis = (p, s) => writeFileSync(join(tmp, p), s)

const bp21 = /name="BP21"/.test(baca('xl/workbook.xml'))
if (!bp21 && !/name="BP26"/.test(baca('xl/workbook.xml')))
  throw new Error('Bukan template BP21 atau BP26 DJP')

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
const serial = (tgl) => {
  const [y, m, d] = tgl.split('-').map(Number)
  return Date.UTC(y, m - 1, d) / 86400000 + 25569
}

const s1 = baca('xl/worksheets/sheet1.xml') // sheet1 = DATA di kedua template
const barisAsli = (r) => new RegExp(`<row r="${r}"[\\s\\S]*?</row>`).exec(s1)?.[0] ?? ''
const contoh = barisAsli(4)
const gaya = Object.fromEntries(
  [...contoh.matchAll(/<c r="([A-Z]+)4"( s="\d+")?/g)].map((m) => [m[1], m[2] ?? '']),
)
// Rumus baris 4 (masih ter-escape XML), referensi sel baris 4 diganti nomor baris baru
const rumus = Object.fromEntries(
  [...contoh.matchAll(/<c r="([A-Z]+)4"[^>]*><f>([^<]*)<\/f>/g)].map((m) => [m[1], m[2]]),
)
const T = (k, r, v) =>
  v === undefined || v === null || v === '' ? '' : `<c r="${k}${r}"${gaya[k]} t="s"><v>${str(v)}</v></c>`
const N = (k, r, v) =>
  v === undefined || v === null || v === '' ? '' : `<c r="${k}${r}"${gaya[k]}><v>${v}</v></c>`
const D = (k, r, v) => (v ? N(k, r, serial(v)) : '')
const F = (k, r) =>
  `<c r="${k}${r}"${gaya[k]}${k === 'S' ? ' t="str"' : ''}><f>${rumus[k].replace(/(?<![$A-Z])([A-Z]{1,2})4\b/g, `$1${r}`)}</f></c>`

const rows = batch.bupot.map((b, i) => {
  const r = 4 + i
  const p = b.penerima
  const sel = bp21
    ? [
        N('B', r, b.masa),
        N('C', r, b.tahun),
        T('D', r, p.npwp),
        T('E', r, p.nitku ?? `${p.npwp}000000`),
        T('F', r, p.statusPtkp),
        T('G', r, b.fasilitas ?? 'N/A'),
        T('H', r, b.kodeObjekPajak),
        N('I', r, b.penghasilan),
        F('J', r),
        F('K', r),
        T('L', r, b.jenisDokumen),
        T('M', r, b.nomorDokumen),
        D('N', r, b.tanggalDokumen),
        T('O', r, b.nitkuPemotong ?? batch.pemotong.nitku),
        D('P', r, b.tanggalPemotongan),
        ...['R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'].map((k) => F(k, r)),
      ]
    : [
        N('B', r, b.masa),
        N('C', r, b.tahun),
        T('D', r, p.tin),
        T('E', r, p.nama),
        T('F', r, p.negara),
        T('G', r, p.alamat),
        D('H', r, p.tanggalLahir),
        T('I', r, p.tempatLahir),
        T('J', r, p.paspor),
        T('K', r, p.kitas),
        T('L', r, b.fasilitas ?? 'N/A'),
        T('M', r, b.nomorFasilitas ?? '-'),
        T('N', r, b.kodeObjekPajak),
        N('O', r, b.penghasilan),
        N('P', r, b.deemed),
        N('Q', r, b.tarif),
        T('R', r, b.jenisDokumen),
        T('S', r, b.nomorDokumen),
        D('T', r, b.tanggalDokumen),
        T('U', r, b.nitkuPemotong ?? batch.pemotong.nitku),
        D('V', r, b.tanggalPemotongan),
      ]
  return `<row r="${r}">${sel.join('')}</row>`
})
const akhir = 3 + batch.bupot.length
const kolomAkhir = bp21 ? 'Z' : 'V'
const baris1 = barisAsli(1).replace(
  /<c r="C1"[^>]*>[\s\S]*?<\/c>/,
  () => `<c r="C1"${gaya.D} t="s"><v>${str(batch.pemotong.npwp)}</v></c>`,
)
tulis(
  'xl/worksheets/sheet1.xml',
  s1
    .replace(
      /<sheetData>[\s\S]*<\/sheetData>/,
      () => `<sheetData>${baris1}${barisAsli(3)}${rows.join('')}</sheetData>`,
    )
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="A1:${kolomAkhir}${akhir}"/>`)
    .replace(/<selection [^>]*\/>/, ''),
)

// Tabel XML Map (B3:P.. atau B3:V..) diperluas ke baris terakhir
const tabel = baca('xl/tables/table1.xml').replace(/ref="B3:([A-Z]+)\d+"/g, `ref="B3:$1${akhir}"`)
tulis('xl/tables/table1.xml', tabel)

sst = sst
  .replace('</sst>', `${baru.join('')}</sst>`)
  .replace(/uniqueCount="\d+"/, `uniqueCount="${jumlahSi + baru.length}"`)
tulis('xl/sharedStrings.xml', sst)

// Nilai rumus tidak ditulis: Excel menghitung ulang saat file dibuka. calcChain lama dibuang.
tulis(
  'xl/workbook.xml',
  baca('xl/workbook.xml').replace(/<calcPr ([^>]*)\/>/, '<calcPr $1 fullCalcOnLoad="1"/>'),
)
if (existsSync(join(tmp, 'xl/calcChain.xml'))) {
  rmSync(join(tmp, 'xl/calcChain.xml'))
  tulis(
    '[Content_Types].xml',
    baca('[Content_Types].xml').replace(/<Override PartName="\/xl\/calcChain.xml"[^>]*\/>/, ''),
  )
  tulis(
    'xl/_rels/workbook.xml.rels',
    baca('xl/_rels/workbook.xml.rels').replace(/<Relationship [^>]*calcChain[^>]*\/>/, ''),
  )
}

execFileSync(tar, ['--format', 'zip', '-cf', resolve(keluaran), '-C', tmp, ...readdirSync(tmp)])
rmSync(tmp, { recursive: true, force: true })
console.log(`${keluaran}: ${batch.bupot.length} bukti potong ${bp21 ? 'PPh 21' : 'PPh 26'}`)
