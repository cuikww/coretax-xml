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

export const JUDUL_RETUR = [
  'Baris',
  'Nomor Faktur',
  'NPWP Penjual',
  'Tanggal Retur',
  'DPP Retur',
  'DPP Lain Retur',
  'PPN Retur',
  'PPnBM Retur',
  'Total DPP Retur',
  'Total DPP Lain Retur',
  'Total PPN Retur',
  'Total PPnBM Retur',
]
export const JUDUL_DETAIL_RETUR = [
  'Baris',
  'Jenis Barang Jasa',
  'Nama Barang Jasa',
  'Kode Barang Jasa',
  'Jumlah Barang Jasa',
  'Satuan Ukur Barang Jasa',
  'Harga Satuan',
  'Jumlah Barang Retur',
  'Diskon Retur',
  'DPP Retur',
  'Flag DPP Lain Retur',
  'DPP Lain Retur',
  'PPN Retur',
  'Tarif PPnBM',
  'PPNBM Retur',
]

/** Serial tanggal Excel dari YYYY-MM-DD. */
export const serial = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number]
  return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000
}

/** Retur 27-02-2025: 1 dari 20 unit @ 10000, PPN 1100 (sama seperti sampel resmi DJP). */
export const barisRetur = (baris: number, ...ubah: [number, SelUji][]): SelUji[] => {
  const b: SelUji[] = [
    baris,
    '04002500000348920',
    '1091031210912281',
    serial('2025-02-27'),
    10000,
    10000,
    1100,
    0,
    { rumus: 'E4', hasil: 10000 },
    { rumus: 'F4', hasil: 10000 },
    { rumus: 'G4', hasil: 1100 },
    { rumus: 'H4', hasil: 0 },
  ]
  for (const [i, v] of ubah) b[i] = v
  return b
}
export const barisDetailRetur = (baris: number, ...ubah: [number, SelUji][]): SelUji[] => {
  const b: SelUji[] = [
    baris,
    'A',
    'Barang',
    '000000',
    20,
    'UM.0033',
    10000,
    1,
    0,
    { rumus: 'H2*G2', hasil: 10000 },
    'No',
    { rumus: 'J2', hasil: 10000 },
    1100,
    0,
    0,
  ]
  for (const [i, v] of ubah) b[i] = v
  return b
}
export function templateRetur(
  retur: SelUji[][],
  detail: SelUji[][],
  npwpPembeli = '1091031210912281',
): Uint8Array {
  return buatXlsx({
    Retur: [['NPWP Pembeli', undefined, npwpPembeli], [], JUDUL_RETUR, ...retur, ['END']],
    DetailRetur: [JUDUL_DETAIL_RETUR, ...detail, ['END']],
  })
}
