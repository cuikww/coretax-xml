/**
 * Skema retur faktur pajak masukan, versi 2025.03 (root XML `InputTaxInvoiceReturn`).
 *
 * Dasar: "Sample Retur Faktur PM Template v.1.1.xml" dan template Excel "Sample Retur Faktur PM Template v.1.1.xlsx"
 * dari paket resmi DJP ConverterEfakturCoretax v1.6 (diunduh 2026-11-05, lihat fixtures/djp/README.md).
 *
 * STATUS: urutan elemen dari sampel resmi; aturan dari sheet Keterangan template. Belum ada golden file dari
 * converter dan belum diuji impor di Coretax. DJP tidak menerbitkan XSD.
 */
import type { MetaSkema } from '../faktur-keluaran/v2025-09.js'

export interface MetaSkemaRetur extends Omit<MetaSkema, 'dokumen'> {
  dokumen: 'retur-masukan'
}

export const meta: MetaSkemaRetur = {
  id: '2025.03',
  dokumen: 'retur-masukan',
  berlakuMulai: '2025-01-01',
  template: 'Sample Retur Faktur PM Template v.1.1.xlsx / Sample Retur Faktur PM Template v.1.1.xml',
  converter: 'ConverterEfakturCoretax v1.6',
  terverifikasiDenganXsdResmi: false,
  sumber: [
    'https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml',
    'https://pajak.go.id/sites/default/files/2025-03/Sample%20Retur%20Faktur%20PM%20Template%20v.1.1.xml.zip',
  ],
}

/** Anak langsung `TransactionDocumentData`. */
export const elemenDokumen = [
  'InvoiceNumber',
  'SellerTIN',
  'ReturnDate',
  'ReturnTaxBase',
  'ReturnOtherTaxBase',
  'ReturnVAT',
  'ReturnSTLG',
] as const

/** Anak langsung `Rows` (satu baris barang/jasa). */
export const elemenBaris = [
  'Type',
  'Name',
  'Code',
  'Quantity',
  'Unit',
  'UnitPrice',
  'STLGRate',
  'ReturnQuantity',
  'ReturnDiscount',
  'ReturnTaxBase',
  'ReturnOtherTaxBase',
  'ReturnOtherTaxBaseCheck',
  'ReturnVAT',
  'ReturnSTLG',
] as const

/** Anak langsung `FooterRow`: total yang harus sama dengan nilai di TransactionDocumentData. */
export const elemenFooter = [
  'ReturnTaxBaseTotal',
  'ReturnOtherTaxBaseTotal',
  'ReturnVATTotal',
  'ReturnSTLGTotal',
] as const

/** Pasangan elemen dokumen dan elemen footer yang harus bernilai sama (sheet Keterangan: "Diisi sama dengan ..."). */
export const pasanganFooter = [
  ['ReturnTaxBase', 'ReturnTaxBaseTotal'],
  ['ReturnOtherTaxBase', 'ReturnOtherTaxBaseTotal'],
  ['ReturnVAT', 'ReturnVATTotal'],
  ['ReturnSTLG', 'ReturnSTLGTotal'],
] as const

/** Nomor faktur yang diretur: 17 digit (sampel dan contoh template). */
export const PANJANG_NOMOR_FAKTUR = 17
