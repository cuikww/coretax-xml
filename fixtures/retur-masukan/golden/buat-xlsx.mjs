// Isi sheet Retur + DetailRetur di template Excel retur resmi DJP dari kasus.json.
// Pemakaian: node buat-xlsx.mjs <folder ConverterEfakturCoretax_v1.6> <kasus.json> <keluaran.xlsx>
// Semua angka diambil apa adanya dari JSON; skrip tidak menghitung. Kolom Total di sheet Retur = kolom nilainya
// (DJP: "Diisi sama dengan ...").
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
const tmp = mkdtempSync(join(tmpdir(), 'xlsx-retur-'))
execFileSync(tar, [
  '-xf',
  join(folder, 'TemplateExcel', 'Sample Retur Faktur PM Template v.1.1.xlsx'),
  '-C',
  tmp,
])
const baca = (p) => readFileSync(join(tmp, p), 'utf8')
const tulis = (p, s) => writeFileSync(join(tmp, p), s)

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

const returRows = []
const detailRows = []
batch.retur.forEach((r, n) => {
  const nr = 4 + n
  returRows.push(
    baris(nr, [
      N(nr, 0, n + 1, 5),
      T(nr, 1, r.nomorFaktur, 1),
      T(nr, 2, r.npwpPenjual, 1),
      N(nr, 3, serial(r.tanggal), 6),
      N(nr, 4, r.dpp, 7),
      N(nr, 5, r.dppLain, 7),
      N(nr, 6, r.ppn),
      N(nr, 7, r.ppnbm),
      N(nr, 8, r.dpp),
      N(nr, 9, r.dppLain),
      N(nr, 10, r.ppn),
      N(nr, 11, r.ppnbm),
    ]),
  )
  for (const it of r.item) {
    const d = 2 + detailRows.length
    detailRows.push(
      baris(d, [
        N(d, 0, n + 1),
        T(d, 1, it.jenis === 'jasa' ? 'B' : 'A'),
        T(d, 2, it.nama),
        T(d, 3, it.kode ?? '000000', 1),
        N(d, 4, it.jumlah),
        T(d, 5, it.satuan),
        N(d, 6, it.harga),
        N(d, 7, it.jumlahRetur),
        N(d, 8, it.diskonRetur ?? 0),
        N(d, 9, it.dpp),
        T(d, 10, it.pakaiDppLain ? 'Yes' : 'No'),
        N(d, 11, it.dppLain),
        N(d, 12, it.ppn),
        N(d, 13, it.tarifPpnbm ?? 0),
        N(d, 14, it.ppnbm),
      ]),
    )
  }
})

const ganti = (xml, sheetData, dimensi) =>
  xml
    .replace(/<sheetData>[\s\S]*<\/sheetData>/, () => `<sheetData>${sheetData}</sheetData>`)
    .replace(/<dimension ref="[^"]*"\/>/, `<dimension ref="${dimensi}"/>`)

// sheet1 = Retur, sheet2 = DetailRetur
const s1 = baca('xl/worksheets/sheet1.xml')
const baris1 = barisAsli(s1, 1).replace(
  /<c r="C1"[^>]*>[\s\S]*?<\/c>/,
  () => `<c r="C1" s="2" t="s"><v>${str(batch.pembeli.npwp)}</v></c>`,
)
const akhir1 = 4 + batch.retur.length
tulis(
  'xl/worksheets/sheet1.xml',
  ganti(
    s1,
    baris1 +
      barisAsli(s1, 2) +
      barisAsli(s1, 3) +
      returRows.join('') +
      baris(akhir1, [T(akhir1, 0, 'END', 8)]),
    `A1:L${akhir1}`,
  ),
)
const s2 = baca('xl/worksheets/sheet2.xml')
const akhir2 = 2 + detailRows.length
tulis(
  'xl/worksheets/sheet2.xml',
  ganti(s2, barisAsli(s2, 1) + detailRows.join('') + baris(akhir2, [T(akhir2, 0, 'END')]), `A1:O${akhir2}`),
)

sst = sst
  .replace('</sst>', `${baru.join('')}</sst>`)
  .replace(/uniqueCount="\d+"/, `uniqueCount="${jumlahSi + baru.length}"`)
tulis('xl/sharedStrings.xml', sst)

// Rumus lama dibuang, jadi daftar urutan hitung (calcChain) ikut dibuang
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
console.log(`${keluaran}: ${batch.retur.length} retur, ${detailRows.length} baris detail`)
