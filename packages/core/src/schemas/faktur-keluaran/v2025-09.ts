/**
 * Skema faktur pajak keluaran, versi 2025.09.
 *
 * Dasar: template Excel faktur pajak keluaran v1.6 (diumumkan 24 September 2025)
 * dengan converter XML v1.5, serta sampel XML yang dikutip pihak ketiga.
 *
 * STATUS: disusun dari sumber sekunder. Wajib dicocokkan dengan XSD dan template
 * resmi dari https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml
 * sebelum rilis 1.0. Lihat docs/DECISIONS.md.
 */

export interface MetaSkema {
  id: string
  dokumen: 'faktur-keluaran'
  /** Tanggal faktur paling awal yang memakai skema ini (YYYY-MM-DD). */
  berlakuMulai: string
  template: string
  converter: string
  terverifikasiDenganXsdResmi: boolean
  sumber: string[]
}

export const meta: MetaSkema = {
  id: '2025.09',
  dokumen: 'faktur-keluaran',
  berlakuMulai: '2025-01-01',
  template: 'Template Excel Faktur PK v1.6 / Sample Faktur PK Template v1.4',
  converter: 'Converter XML v1.5',
  terverifikasiDenganXsdResmi: false,
  sumber: [
    'https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml',
    'https://news.ddtc.co.id/berita/nasional/1813944/perhatian-ada-update-template-excel-faktur-pajak-keluaran',
    'https://news.ddtc.co.id/berita/nasional/1809266/djp-luncurkan-aplikasi-converter-xml-versi-15',
    'https://www.sipajak.com/post/format-xml-faktur-pajak-coretax',
  ],
}

/** Urutan elemen header per faktur, persis seperti sampel DJP. */
export const elemenFaktur = [
  'TaxInvoiceDate',
  'TaxInvoiceOpt',
  'TrxCode',
  'AddInfo',
  'CustomDoc',
  'CustomDocMonthYear',
  'RefDesc',
  'FacilityStamp',
  'SellerIDTKU',
  'BuyerTin',
  'BuyerDocument',
  'BuyerCountry',
  'BuyerDocumentNumber',
  'BuyerName',
  'BuyerAdress', // ejaan resmi DJP (satu "d")
  'BuyerEmail',
  'BuyerIDTKU',
] as const

/** Urutan elemen per item barang/jasa. */
export const elemenItem = [
  'Opt',
  'Code',
  'Name',
  'Unit',
  'Price',
  'Qty',
  'TotalDiscount',
  'TaxBase',
  'OtherTaxBase',
  'VATRate',
  'VAT',
  'STLGRate',
  'STLG',
] as const

export type ElemenFaktur = (typeof elemenFaktur)[number]
export type ElemenItem = (typeof elemenItem)[number]

/**
 * Kode transaksi faktur pajak. Deskripsi ringkas mengikuti kode transaksi e-Faktur;
 * cocokkan dengan sheet REF di template resmi.
 */
export const kodeTransaksi: Record<string, string> = {
  '01': 'Kepada pihak yang bukan pemungut PPN',
  '02': 'Kepada pemungut PPN instansi pemerintah',
  '03': 'Kepada pemungut PPN selain instansi pemerintah',
  '04': 'DPP nilai lain',
  '05': 'Besaran tertentu',
  '06': 'Penyerahan lainnya (termasuk kepada turis)',
  '07': 'Penyerahan yang PPN-nya tidak dipungut atau ditanggung pemerintah',
  '08': 'Penyerahan yang dibebaskan dari pengenaan PPN',
  '09': 'Penyerahan aktiva (Pasal 16D UU PPN)',
  '10': 'Penyerahan lainnya',
}

/** Kode transaksi yang PPN-nya wajib sama dengan tarif x DPP nilai lain. */
export const kodeDenganRumusPpn = new Set(['01', '04', '09'])

/** Kode transaksi yang wajib mengisi keterangan tambahan dan cap fasilitas. */
export const kodeWajibFasilitas = new Set(['07', '08'])

/**
 * Kode satuan UM.0001 sampai UM.0039 (UM.0034 sampai UM.0039 ditambahkan di template v1.6).
 * Nama satuan diisi dari sheet REF template resmi; yang sudah diketahui dari pengumuman DJP:
 */
export const satuan: Record<string, string | null> = Object.fromEntries(
  Array.from({ length: 39 }, (_, i) => [`UM.${String(i + 1).padStart(4, '0')}`, null]),
)
Object.assign(satuan, {
  'UM.0034': 'Meter Kubik',
  'UM.0035': 'Sentimeter Persegi',
  'UM.0036': 'Drum',
  'UM.0037': 'Karton',
  'UM.0038': 'Kwh',
  'UM.0039': 'Roll',
})

export const jenisId = ['TIN', 'National ID', 'Passport', 'Other ID'] as const

/** Pola kode keterangan tambahan dan cap fasilitas. Daftar lengkap ada di sheet REF template resmi. */
export const polaKeteranganTambahan = /^TD\.005\d{2}$/
export const polaCapFasilitas = /^TD\.011\d{2}$/

export const BUYER_TIN_NOL = '0000000000000000'
export const BUYER_IDTKU_NOL = '000000'
export const KODE_BARANG_DEFAULT = '000000'
export const TARIF_PPN_DEFAULT = '12'
