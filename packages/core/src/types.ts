/** Angka boleh number atau string desimal dengan titik ("1234.5"). Maksimal 2 desimal. */
export type Angka = number | string

/** Jenis dokumen identitas pembeli, ditulis persis seperti nilai `BuyerDocument` DJP. */
export type JenisId = 'TIN' | 'National ID' | 'Passport' | 'Other ID'

export interface Penjual {
  /** NPWP penjual, 16 digit tanpa pemisah. Ditulis ke `TIN`. */
  npwp: string
  /** NITKU penjual, 22 digit. Ditulis ke `SellerIDTKU`. */
  nitku: string
}

export interface Pembeli {
  jenisId: JenisId
  /** NPWP/NIK pembeli 16 digit. Wajib jika jenisId = 'TIN'; selain itu diisi 16 nol. */
  npwp?: string
  /** NITKU pembeli 22 digit jika jenisId = 'TIN'; selain itu '000000'. */
  nitku?: string
  /** Nomor dokumen (NIK, paspor, dll). Wajib jika jenisId bukan 'TIN'; untuk 'TIN' ditulis '-'. */
  nomorDokumen?: string
  nama: string
  alamat: string
  email?: string
  /** Kode negara 3 huruf. Default 'IDN' (Indonesia). Perhatian: 'IND' adalah India. */
  negara?: string
}

export interface ItemFaktur {
  jenis: 'barang' | 'jasa'
  /** Kode barang/jasa 6 digit. Default '000000'. */
  kode?: string
  nama: string
  /** Kode satuan DJP, mis. 'UM.0033'. */
  satuan: string
  harga: Angka
  jumlah: Angka
  /** Total diskon item (bukan per unit). Default 0. */
  diskon?: Angka
  /** Tarif PPN dalam persen. Default 12. */
  tarifPpn?: Angka
  /** Tarif PPnBM dalam persen. Default 0. */
  tarifPpnbm?: Angka
  /** Jika diisi, diperiksa terhadap hasil hitung. Wajib di mode 'strict'. */
  dpp?: Angka
  /** DPP nilai lain. Jika kosong: 11/12 x DPP untuk kode transaksi 04, selain itu sama dengan DPP. */
  dppNilaiLain?: Angka
  ppn?: Angka
  ppnbm?: Angka
}

export type KodeTransaksi = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10'

export interface FakturKeluaran {
  /** Tanggal faktur, format YYYY-MM-DD. */
  tanggal: string
  kodeTransaksi: KodeTransaksi
  /** Referensi internal, mis. nomor invoice. Ditulis ke `RefDesc`. */
  referensi?: string
  /** Kode keterangan tambahan (TD.005xx) dari `referensi.keteranganTambahan()`. Wajib untuk kode transaksi 07 dan 08. */
  keteranganTambahan?: string
  /** Nomor dokumen pendukung. Ditulis ke `CustomDoc`. */
  dokumenPendukung?: string
  /** Periode dokumen pendukung, format MMYYYY. Ditulis ke `CustomDocMonthYear`. */
  periodeDokumenPendukung?: string
  /** Kode cap fasilitas (TD.011xx) dari `referensi.capFasilitas()`. Wajib untuk kode transaksi 07 dan 08. */
  capFasilitas?: string
  pembeli: Pembeli
  item: ItemFaktur[]
}

export interface BatchFakturKeluaran {
  penjual: Penjual
  faktur: FakturKeluaran[]
}

export type Bahasa = 'id' | 'en'

export interface OpsiValidasi {
  /** 'auto' (default) memilih skema dari tanggal faktur, atau id skema seperti '2025.09'. */
  schema?: string
  /** 'otomatis' (default) menghitung DPP/PPN yang kosong; 'strict' mewajibkan semua angka diisi. */
  hitung?: 'otomatis' | 'strict'
  bahasa?: Bahasa
  /** Samarkan NPWP/NIK/NITKU di pesan error. Default true. */
  samarkan?: boolean
}

export type OpsiBuild = OpsiValidasi

export interface MasalahValidasi {
  code: KodeError
  level: 'error' | 'warning'
  /** Nomor faktur, mulai dari 1. null untuk masalah di tingkat batch. */
  faktur: number | null
  /** Nomor item, mulai dari 1. null jika bukan masalah item. */
  item: number | null
  /** Path field input, mis. 'pembeli.nitku'. */
  field: string
  /** Nama elemen XML DJP yang terkait. */
  element: string | null
  nilai?: string
  pesan: string
  saran?: string
}

export interface HasilValidasi {
  valid: boolean
  schema: string
  errors: MasalahValidasi[]
  warnings: MasalahValidasi[]
}

export type KodeError =
  | 'REQUIRED'
  | 'NPWP_FORMAT'
  | 'NITKU_FORMAT'
  | 'DATE_FORMAT'
  | 'TRX_CODE_UNKNOWN'
  | 'BUYER_DOC_UNKNOWN'
  | 'BUYER_IDTKU_MISMATCH'
  | 'BUYER_TIN_NOT_ALLOWED'
  | 'BUYER_DOC_NUMBER_REQUIRED'
  | 'COUNTRY_UNKNOWN'
  | 'COUNTRY_IND'
  | 'EMAIL_FORMAT'
  | 'ADDINFO_REQUIRED'
  | 'ADDINFO_UNKNOWN'
  | 'FACILITY_REQUIRED'
  | 'FACILITY_UNKNOWN'
  | 'CUSTOM_DOC_PERIOD_FORMAT'
  | 'ITEMS_EMPTY'
  | 'ITEM_TYPE_UNKNOWN'
  | 'UNIT_UNKNOWN'
  | 'GOODS_CODE_FORMAT'
  | 'GOODS_CODE_DEFAULT'
  | 'NUMBER_FORMAT'
  | 'NUMBER_DECIMALS'
  | 'NUMBER_NEGATIVE'
  | 'QTY_ZERO'
  | 'DISCOUNT_TOO_LARGE'
  | 'DPP_MISMATCH'
  | 'DPP_NL_TOO_LARGE'
  | 'VAT_MISMATCH'
  | 'STLG_MISMATCH'
  | 'STRICT_VALUE_MISSING'
  | 'SCHEMA_UNKNOWN'
  | 'SCHEMA_DATE_BEFORE'
  | 'FAKTUR_EMPTY'
  | 'XML_PARSE'
  | 'XML_ROOT'
  | 'XML_ELEMENT_MISSING'
  | 'XML_ELEMENT_UNKNOWN'
  | 'XML_ELEMENT_ORDER'
  | 'XML_SELLER_MISMATCH'
  | 'INVOICE_NUMBER_FORMAT'
  | 'RETUR_EMPTY'
  | 'RETUR_QTY_EXCEEDS'
  | 'RETUR_OTHER_BASE_MISMATCH'
  | 'RETUR_DPP_MISMATCH'
  | 'RETUR_TOTAL_MISMATCH'
  | 'RETUR_FOOTER_MISMATCH'
  | 'RETUR_BOOL_FORMAT'
  | 'RETUR_DATE_FORMAT'
