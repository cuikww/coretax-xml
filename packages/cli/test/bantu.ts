import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { jalankan } from '../src/cli.js'

export type SelUji = string | number | { rumus: string; hasil: number } | undefined

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const huruf = (i: number) => String.fromCharCode(65 + i)

/** Buat file .xlsx minimal dengan struktur yang sama seperti buatan Excel: sharedStrings, sel angka, sel rumus dengan nilai tersimpan. */
export function buatXlsx(sheets: Record<string, SelUji[][]>): Uint8Array {
  const sst: string[] = []
  const idx = (s: string) => {
    const i = sst.indexOf(s)
    if (i >= 0) return i
    sst.push(s)
    return sst.length - 1
  }
  const nama = Object.keys(sheets)
  const xmlSheet = (baris: SelUji[][]) =>
    `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${baris
      .map((b, r) =>
        b.length === 0
          ? ''
          : `<row r="${r + 1}">${b
              .map((v, c) => {
                const a = `${huruf(c)}${r + 1}`
                if (v === undefined) return `<c r="${a}"/>`
                if (typeof v === 'string') return `<c r="${a}" t="s"><v>${idx(v)}</v></c>`
                if (typeof v === 'number') return `<c r="${a}"><v>${v}</v></c>`
                return `<c r="${a}"><f>${esc(v.rumus)}</f><v>${v.hasil}</v></c>`
              })
              .join('')}</row>`,
      )
      .join('')}</sheetData></worksheet>`
  const lembar = nama.map((n) => xmlSheet(sheets[n] as SelUji[][]))
  const berkas: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${nama
        .map((n, i) => `<sheet name="${esc(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${nama
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="x" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}</Relationships>`,
    ),
  }
  lembar.forEach((x, i) => {
    berkas[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(x)
  })
  berkas['xl/sharedStrings.xml'] = strToU8(
    `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${sst
      .map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`)
      .join('')}</sst>`,
  )
  return zipSync(berkas)
}

const NOL16 = '0000000000000000'
const NOL22 = '0000000000000000000000'

export const JUDUL_FAKTUR = [
  'Baris',
  'Tanggal Faktur',
  'Jenis Faktur',
  'Kode Transaksi',
  'Keterangan Tambahan',
  'Dokumen Pendukung',
  'Period Dok Pendukung',
  'Referensi',
  'Cap Fasilitas',
  'ID TKU Penjual',
  'NPWP/NIK Pembeli',
  'Jenis ID Pembeli',
  'Negara Pembeli',
  'Nomor Dokumen Pembeli',
  'Nama Pembeli',
  'Alamat Pembeli',
  'Email Pembeli',
  'ID TKU Pembeli',
]
export const JUDUL_DETAIL = [
  'Baris',
  'Barang/Jasa',
  'Kode Barang Jasa',
  'Nama Barang/Jasa',
  'Nama Satuan Ukur',
  'Harga Satuan',
  'Jumlah Barang Jasa',
  'Total Diskon',
  'DPP',
  'DPP Nilai Lain',
  'Tarif PPN',
  'PPN',
  'Tarif PPnBM',
  'PPnBM',
]

/** Faktur kode 04, 2 x 600000 jasa; tanggal sebagai nomor seri Excel (46296 = 2026-10-01). Rumus dengan nilai tersimpan seperti template DJP. */
export const barisFaktur = (baris: number, ...ubah: [number, SelUji][]): SelUji[] => {
  const b: SelUji[] = [
    baris,
    46296,
    'Normal',
    '04',
    undefined,
    undefined,
    undefined,
    `REF-${baris}`,
    undefined,
    NOL22,
    NOL16,
    'TIN',
    'IDN',
    '-',
    'PT Contoh',
    'Jl. Contoh',
    'a@contoh.test',
    NOL22,
  ]
  for (const [i, v] of ubah) b[i] = v
  return b
}
export const barisDetail = (baris: number, ...ubah: [number, SelUji][]): SelUji[] => {
  const b: SelUji[] = [
    baris,
    'B',
    '000000',
    'Jasa',
    'UM.0033',
    600000,
    2,
    0,
    { rumus: 'G2*F2-H2', hasil: 1200000 },
    { rumus: '11/12*I2', hasil: 1100000 },
    12,
    { rumus: 'J2*K2/100', hasil: 132000 },
    0,
    { rumus: 'M2*J2/100', hasil: 0 },
  ]
  for (const [i, v] of ubah) b[i] = v
  return b
}

export function templateExcel(faktur: SelUji[][], detail: SelUji[][], npwp = NOL16): Uint8Array {
  return buatXlsx({
    Faktur: [['NPWP Penjual', undefined, npwp], [], JUDUL_FAKTUR, ...faktur, ['END']],
    DetailFaktur: [JUDUL_DETAIL, ...detail, ['END']],
  })
}

export function folderSementara(): string {
  return mkdtempSync(join(tmpdir(), 'coretax-cli-'))
}

export function tulis(folder: string, nama: string, isi: Uint8Array | string): string {
  const p = join(folder, nama)
  writeFileSync(p, isi)
  return p
}

/** Jalankan CLI dan tangkap keluarannya. */
export async function cli(...argv: string[]) {
  let out = ''
  let err = ''
  const kode = await jalankan(argv, { stdout: (s) => (out += s), stderr: (s) => (err += s) })
  return { kode, out, err }
}
