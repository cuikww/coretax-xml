import type { Bahasa, KodeError } from './types.js'

export type Param = Record<string, string | number>

interface Teks {
  pesan: (p: Param) => string
  saran?: (p: Param) => string
}

type Katalog = Record<KodeError, Teks>

const id: Katalog = {
  REQUIRED: { pesan: (p) => `${p.label} wajib diisi.` },
  NPWP_FORMAT: {
    pesan: (p) => `${p.label} harus 16 digit angka, ditemukan ${p.panjang} karakter.`,
    saran: () => 'Hapus titik, strip, dan spasi. NPWP 15 digit lama perlu diubah ke format 16 digit.',
  },
  NITKU_FORMAT: {
    pesan: (p) => `${p.label} harus 22 digit angka, ditemukan ${p.panjang} karakter.`,
    saran: () => 'NITKU adalah NPWP 16 digit diikuti 6 digit nomor tempat kegiatan usaha.',
  },
  DATE_FORMAT: {
    pesan: (p) => `${p.label} "${p.nilai}" bukan tanggal yang valid. Gunakan format YYYY-MM-DD.`,
  },
  TRX_CODE_UNKNOWN: {
    pesan: (p) => `Kode transaksi "${p.nilai}" tidak dikenal.`,
    saran: () => 'Gunakan kode 01 sampai 10.',
  },
  BUYER_DOC_UNKNOWN: {
    pesan: (p) => `Jenis ID pembeli "${p.nilai}" tidak dikenal.`,
    saran: () => 'Gunakan salah satu: "TIN", "National ID", "Passport", "Other ID".',
  },
  BUYER_IDTKU_MISMATCH: {
    pesan: (p) =>
      p.jenisId === 'TIN'
        ? 'Jenis ID pembeli "TIN" harus memakai ID TKU (NITKU) 22 digit.'
        : `Jenis ID pembeli "${p.jenisId}" harus memakai ID TKU "000000".`,
    saran: (p) =>
      p.jenisId === 'TIN'
        ? 'Isi pembeli.nitku dengan NITKU pembeli 22 digit.'
        : 'Kosongkan pembeli.nitku (akan diisi "000000"), atau ubah jenisId ke "TIN" jika pembeli sudah terdaftar di Coretax.',
  },
  BUYER_TIN_NOT_ALLOWED: {
    pesan: (p) => `NPWP pembeli tidak dipakai untuk jenis ID "${p.jenisId}"; nilainya akan diabaikan.`,
    saran: () => 'Isi NIK atau nomor paspor di pembeli.nomorDokumen.',
  },
  BUYER_DOC_NUMBER_REQUIRED: {
    pesan: (p) => `Nomor dokumen pembeli wajib diisi untuk jenis ID "${p.jenisId}".`,
    saran: () => 'Isi pembeli.nomorDokumen dengan NIK, nomor paspor, atau nomor dokumen lain.',
  },
  COUNTRY_UNKNOWN: {
    pesan: (p) => `Kode negara "${p.nilai}" tidak ada di daftar negara DJP.`,
    saran: () => 'Pakai kode 3 huruf dari referensi.negara(), mis. "IDN" untuk Indonesia.',
  },
  COUNTRY_IND: {
    pesan: () => 'Kode negara "IND" adalah India, bukan Indonesia.',
    saran: () => 'Gunakan "IDN" untuk Indonesia.',
  },
  EMAIL_FORMAT: { pesan: (p) => `Email pembeli "${p.nilai}" tidak tampak valid.` },
  ADDINFO_REQUIRED: {
    pesan: (p) => `Kode transaksi ${p.kode} wajib mengisi keterangan tambahan.`,
    saran: () => 'Isi keteranganTambahan dengan kode TD.005xx dari sheet REF template DJP.',
  },
  ADDINFO_UNKNOWN: {
    pesan: (p) => `Keterangan tambahan "${p.nilai}" tidak ada di daftar untuk kode transaksi ${p.kode}.`,
    saran: () => 'Pakai kode dari referensi.keteranganTambahan(kodeTransaksi).',
  },
  FACILITY_REQUIRED: {
    pesan: (p) => `Kode transaksi ${p.kode} wajib mengisi cap fasilitas.`,
    saran: () => 'Isi capFasilitas dengan kode TD.011xx dari sheet REF template DJP.',
  },
  FACILITY_UNKNOWN: {
    pesan: (p) => `Cap fasilitas "${p.nilai}" tidak ada di daftar untuk kode transaksi ${p.kode}.`,
    saran: () => 'Pakai kode dari referensi.capFasilitas(kodeTransaksi).',
  },
  CUSTOM_DOC_PERIOD_FORMAT: {
    pesan: (p) => `Periode dokumen pendukung "${p.nilai}" harus berformat MMYYYY, mis. "012025".`,
  },
  ITEMS_EMPTY: { pesan: () => 'Faktur harus berisi minimal 1 item barang/jasa.' },
  ITEM_TYPE_UNKNOWN: {
    pesan: (p) => `Jenis item "${p.nilai}" tidak dikenal.`,
    saran: () => 'Gunakan "barang" atau "jasa".',
  },
  UNIT_UNKNOWN: {
    pesan: (p) => `Satuan "${p.nilai}" tidak ada di skema ${p.skema}.`,
    saran: () => 'Gunakan kode satuan UM.0001 sampai UM.0039 dari sheet REF template DJP.',
  },
  GOODS_CODE_FORMAT: { pesan: (p) => `Kode barang/jasa "${p.nilai}" harus 6 digit angka.` },
  GOODS_CODE_DEFAULT: {
    pesan: () => 'Kode barang/jasa tidak diisi, dipakai "000000".',
    saran: () => 'Isi kode barang/jasa yang sesuai referensi DJP jika tersedia.',
  },
  NUMBER_FORMAT: {
    pesan: (p) => `${p.label} "${p.nilai}" bukan angka yang valid.`,
    saran: () => 'Gunakan angka dengan titik sebagai pemisah desimal, tanpa pemisah ribuan, mis. 1250000.5.',
  },
  NUMBER_DECIMALS: { pesan: (p) => `${p.label} "${p.nilai}" punya lebih dari 2 desimal.` },
  NUMBER_NEGATIVE: { pesan: (p) => `${p.label} tidak boleh negatif.` },
  QTY_ZERO: { pesan: () => 'Jumlah barang/jasa harus lebih dari 0.' },
  DISCOUNT_TOO_LARGE: {
    pesan: (p) => `Diskon ${p.diskon} lebih besar dari harga x jumlah ${p.total}.`,
  },
  DPP_MISMATCH: {
    pesan: (p) => `DPP ${p.nilai} tidak sama dengan harga x jumlah - diskon = ${p.harap}.`,
  },
  DPP_NL_TOO_LARGE: {
    pesan: (p) => `DPP nilai lain ${p.nilai} lebih besar dari DPP ${p.dpp}.`,
  },
  VAT_MISMATCH: {
    pesan: (p) => `PPN ${p.nilai} tidak sama dengan ${p.tarif}% x DPP nilai lain ${p.dppNl} = ${p.harap}.`,
    saran: () => 'Kosongkan ppn supaya dihitung otomatis, atau periksa DPP nilai lain dan tarif.',
  },
  STLG_MISMATCH: {
    pesan: (p) => `PPnBM ${p.nilai} tidak sama dengan ${p.tarif}% x DPP nilai lain ${p.dpp} = ${p.harap}.`,
    saran: () => 'Rumus template DJP. Nilai lain tetap boleh dipakai jika memang benar.',
  },
  STRICT_VALUE_MISSING: {
    pesan: (p) => `Mode strict: ${p.label} wajib diisi.`,
    saran: () => 'Isi semua angka (dpp, dppNilaiLain, ppn, ppnbm), atau pakai hitung: "otomatis".',
  },
  SCHEMA_UNKNOWN: { pesan: (p) => `Skema "${p.nilai}" tidak tersedia.` },
  SCHEMA_DATE_BEFORE: {
    pesan: (p) =>
      `Tanggal faktur ${p.nilai} lebih awal dari skema tertua (${p.skema}); skema itu tetap dipakai.`,
  },
  FAKTUR_EMPTY: { pesan: () => 'Batch harus berisi minimal 1 faktur.' },
  INVOICE_NUMBER_FORMAT: {
    pesan: (p) => `Nomor faktur "${p.nilai}" harus 17 digit angka.`,
    saran: () => 'Hapus titik dan strip dari nomor faktur pajak masukan yang diretur.',
  },
  RETUR_EMPTY: { pesan: () => 'Batch harus berisi minimal 1 retur.' },
  RETUR_QTY_EXCEEDS: {
    pesan: (p) => `Jumlah barang retur ${p.retur} melebihi jumlah pada faktur asal (${p.jumlah}).`,
  },
  RETUR_OTHER_BASE_MISMATCH: {
    pesan: (p) =>
      `Flag DPP lain = tidak, tetapi DPP lain retur ${p.dppLain} berbeda dari DPP retur ${p.dpp}.`,
    saran: () =>
      'Isi sama dengan DPP retur, atau set pakaiDppLain: true jika faktur asal memakai DPP nilai lain.',
  },
  RETUR_DPP_MISMATCH: {
    pesan: (p) => `DPP retur ${p.nilai} tidak sama dengan jumlah retur x harga - diskon = ${p.harap}.`,
    saran: () =>
      'Template DJP menghitung jumlah retur x harga tanpa diskon. Pastikan nilai sesuai faktur asal.',
  },
  RETUR_TOTAL_MISMATCH: {
    pesan: (p) => `${p.label} dokumen ${p.nilai} tidak sama dengan jumlah semua item (${p.harap}).`,
  },
  RETUR_FOOTER_MISMATCH: {
    pesan: (p) =>
      `<${p.elemen}> ${p.nilai} tidak sama dengan nilai pada TransactionDocumentData (${p.harap}).`,
    saran: () => 'Total di FooterRow harus diisi sama dengan nilai dokumen.',
  },
  RETUR_BOOL_FORMAT: {
    pesan: (p) => `ReturnOtherTaxBaseCheck harus true atau false, ditemukan "${p.nilai}".`,
  },
  RETUR_DATE_FORMAT: {
    pesan: (p) => `ReturnDate "${p.nilai}" harus berformat DD-MM-YYYY di XML retur, mis. "27-02-2025".`,
  },
  XML_PARSE: { pesan: (p) => `XML tidak dapat dibaca (posisi ${p.posisi}): ${p.detail}.` },
  XML_ROOT: {
    pesan: (p) => `Elemen akar harus <${p.harap}>, ditemukan <${p.nama}>.`,
    saran: () =>
      'Dokumen ini bukan jenis yang diperiksa. Faktur keluaran, retur masukan, dan bukti potong punya akar yang berbeda.',
  },
  XML_ELEMENT_MISSING: { pesan: (p) => `${p.lokasi}: elemen <${p.nama}> tidak ada.` },
  XML_ELEMENT_UNKNOWN: { pesan: (p) => `${p.lokasi}: elemen <${p.nama}> tidak dikenal.` },
  XML_ELEMENT_ORDER: {
    pesan: (p) => `${p.lokasi}: urutan elemen tidak sesuai skema.`,
    saran: (p) => `Urutan yang benar: ${p.urutan}.`,
  },
  XML_SELLER_MISMATCH: {
    pesan: (p) => `SellerIDTKU faktur ke-${p.faktur} berbeda dari faktur pertama.`,
    saran: () => 'Satu file impor hanya untuk satu penjual (satu TIN).',
  },
}

const en: Katalog = {
  REQUIRED: { pesan: (p) => `${p.label} is required.` },
  NPWP_FORMAT: {
    pesan: (p) => `${p.label} must be 16 digits, found ${p.panjang} characters.`,
    saran: () => 'Remove dots, dashes and spaces. Convert old 15-digit NPWP to the 16-digit format.',
  },
  NITKU_FORMAT: {
    pesan: (p) => `${p.label} must be 22 digits, found ${p.panjang} characters.`,
    saran: () => 'NITKU is the 16-digit NPWP followed by a 6-digit place-of-business number.',
  },
  DATE_FORMAT: { pesan: (p) => `${p.label} "${p.nilai}" is not a valid date. Use YYYY-MM-DD.` },
  TRX_CODE_UNKNOWN: {
    pesan: (p) => `Unknown transaction code "${p.nilai}".`,
    saran: () => 'Use a code from 01 to 10.',
  },
  BUYER_DOC_UNKNOWN: {
    pesan: (p) => `Unknown buyer ID type "${p.nilai}".`,
    saran: () => 'Use one of: "TIN", "National ID", "Passport", "Other ID".',
  },
  BUYER_IDTKU_MISMATCH: {
    pesan: (p) =>
      p.jenisId === 'TIN'
        ? 'Buyer ID type "TIN" needs a 22-digit ID TKU (NITKU).'
        : `Buyer ID type "${p.jenisId}" must use ID TKU "000000".`,
    saran: (p) =>
      p.jenisId === 'TIN'
        ? "Set pembeli.nitku to the buyer's 22-digit NITKU."
        : 'Leave pembeli.nitku empty (it becomes "000000"), or set jenisId to "TIN" if the buyer is registered in Coretax.',
  },
  BUYER_TIN_NOT_ALLOWED: {
    pesan: (p) => `The buyer NPWP is not used for ID type "${p.jenisId}" and will be ignored.`,
    saran: () => 'Put the NIK or passport number in pembeli.nomorDokumen.',
  },
  BUYER_DOC_NUMBER_REQUIRED: {
    pesan: (p) => `A buyer document number is required for ID type "${p.jenisId}".`,
  },
  COUNTRY_UNKNOWN: { pesan: (p) => `Country code "${p.nilai}" is not in the DJP country list.` },
  COUNTRY_IND: {
    pesan: () => 'Country code "IND" is India, not Indonesia.',
    saran: () => 'Use "IDN" for Indonesia.',
  },
  EMAIL_FORMAT: { pesan: (p) => `Buyer email "${p.nilai}" does not look valid.` },
  ADDINFO_REQUIRED: {
    pesan: (p) => `Transaction code ${p.kode} requires additional information (TD.005xx).`,
  },
  ADDINFO_UNKNOWN: {
    pesan: (p) => `Additional information "${p.nilai}" is not listed for transaction code ${p.kode}.`,
  },
  FACILITY_REQUIRED: { pesan: (p) => `Transaction code ${p.kode} requires a facility stamp (TD.011xx).` },
  FACILITY_UNKNOWN: {
    pesan: (p) => `Facility stamp "${p.nilai}" is not listed for transaction code ${p.kode}.`,
  },
  CUSTOM_DOC_PERIOD_FORMAT: { pesan: (p) => `Supporting document period "${p.nilai}" must be MMYYYY.` },
  ITEMS_EMPTY: { pesan: () => 'An invoice needs at least 1 item.' },
  ITEM_TYPE_UNKNOWN: { pesan: (p) => `Unknown item type "${p.nilai}". Use "barang" or "jasa".` },
  UNIT_UNKNOWN: { pesan: (p) => `Unit "${p.nilai}" is not in schema ${p.skema}.` },
  GOODS_CODE_FORMAT: { pesan: (p) => `Goods/service code "${p.nilai}" must be 6 digits.` },
  GOODS_CODE_DEFAULT: { pesan: () => 'No goods/service code given, "000000" is used.' },
  NUMBER_FORMAT: { pesan: (p) => `${p.label} "${p.nilai}" is not a valid number.` },
  NUMBER_DECIMALS: { pesan: (p) => `${p.label} "${p.nilai}" has more than 2 decimals.` },
  NUMBER_NEGATIVE: { pesan: (p) => `${p.label} cannot be negative.` },
  QTY_ZERO: { pesan: () => 'Quantity must be greater than 0.' },
  DISCOUNT_TOO_LARGE: { pesan: (p) => `Discount ${p.diskon} is larger than price x quantity ${p.total}.` },
  DPP_MISMATCH: {
    pesan: (p) => `Tax base ${p.nilai} differs from price x quantity - discount = ${p.harap}.`,
  },
  DPP_NL_TOO_LARGE: { pesan: (p) => `Other tax base ${p.nilai} is larger than tax base ${p.dpp}.` },
  VAT_MISMATCH: {
    pesan: (p) => `VAT ${p.nilai} differs from ${p.tarif}% x other tax base ${p.dppNl} = ${p.harap}.`,
  },
  STLG_MISMATCH: {
    pesan: (p) => `Luxury tax ${p.nilai} differs from ${p.tarif}% x other tax base ${p.dpp} = ${p.harap}.`,
  },
  STRICT_VALUE_MISSING: { pesan: (p) => `Strict mode: ${p.label} is required.` },
  SCHEMA_UNKNOWN: { pesan: (p) => `Schema "${p.nilai}" is not available.` },
  SCHEMA_DATE_BEFORE: {
    pesan: (p) => `Invoice date ${p.nilai} is before the oldest schema (${p.skema}); that schema is used.`,
  },
  FAKTUR_EMPTY: { pesan: () => 'A batch needs at least 1 invoice.' },
  INVOICE_NUMBER_FORMAT: { pesan: (p) => `Invoice number "${p.nilai}" must be 17 digits.` },
  RETUR_EMPTY: { pesan: () => 'A batch needs at least 1 return.' },
  RETUR_QTY_EXCEEDS: {
    pesan: (p) => `Returned quantity ${p.retur} exceeds the original invoice quantity (${p.jumlah}).`,
  },
  RETUR_OTHER_BASE_MISMATCH: {
    pesan: (p) =>
      `Other-tax-base flag is off, but return other tax base ${p.dppLain} differs from return tax base ${p.dpp}.`,
    saran: () => 'Use the same value as the tax base, or set pakaiDppLain: true.',
  },
  RETUR_DPP_MISMATCH: {
    pesan: (p) =>
      `Return tax base ${p.nilai} differs from returned quantity x price - discount = ${p.harap}.`,
  },
  RETUR_TOTAL_MISMATCH: {
    pesan: (p) => `Document ${p.label} ${p.nilai} differs from the sum of all items (${p.harap}).`,
  },
  RETUR_FOOTER_MISMATCH: {
    pesan: (p) => `<${p.elemen}> ${p.nilai} differs from TransactionDocumentData (${p.harap}).`,
  },
  RETUR_BOOL_FORMAT: { pesan: (p) => `ReturnOtherTaxBaseCheck must be true or false, found "${p.nilai}".` },
  RETUR_DATE_FORMAT: {
    pesan: (p) => `ReturnDate "${p.nilai}" must be DD-MM-YYYY in return XML, e.g. "27-02-2025".`,
  },
  XML_PARSE: { pesan: (p) => `XML cannot be read (position ${p.posisi}): ${p.detail}.` },
  XML_ROOT: {
    pesan: (p) => `Root element must be <${p.harap}>, found <${p.nama}>.`,
    saran: () =>
      'This is not the document type being checked. Output invoices, input returns and withholding slips have different roots.',
  },
  XML_ELEMENT_MISSING: { pesan: (p) => `${p.lokasi}: element <${p.nama}> is missing.` },
  XML_ELEMENT_UNKNOWN: { pesan: (p) => `${p.lokasi}: unknown element <${p.nama}>.` },
  XML_ELEMENT_ORDER: {
    pesan: (p) => `${p.lokasi}: element order does not match the schema.`,
    saran: (p) => `Correct order: ${p.urutan}.`,
  },
  XML_SELLER_MISMATCH: {
    pesan: (p) => `SellerIDTKU of invoice #${p.faktur} differs from the first invoice.`,
    saran: () => 'One import file is for one seller (one TIN).',
  },
}

const katalog: Record<Bahasa, Katalog> = { id, en }

export function teks(bahasa: Bahasa, kode: KodeError, p: Param): { pesan: string; saran?: string } {
  const t = katalog[bahasa][kode]
  const saran = t.saran?.(p)
  return saran ? { pesan: t.pesan(p), saran } : { pesan: t.pesan(p) }
}

export interface EntriKatalog {
  /** Parameter yang diisi ke template, mis. ["label", "nilai"]. `label` selalu diisi dari nama field. */
  params: string[]
  id: { pesan: string; saran: string | null }
  en: { pesan: string; saran: string | null }
}

/**
 * Katalog kode error sebagai data: template pesan dengan {parameter}, untuk dokumentasi dan port ke bahasa lain
 * (errors/katalog.json). Template dibuat dengan memanggil fungsi pesan memakai parameter pengganti.
 */
export function katalogError(): Record<string, EntriKatalog> {
  const hasil: Record<string, EntriKatalog> = {}
  for (const kode of Object.keys(id) as KodeError[]) {
    const dipakai = new Set<string>()
    const p = new Proxy({} as Param, {
      get: (_, kunci) => {
        dipakai.add(String(kunci))
        return `{${String(kunci)}}`
      },
    })
    const bentuk = (k: Katalog) => ({ pesan: k[kode].pesan(p), saran: k[kode].saran?.(p) ?? null })
    const entri = { id: bentuk(id), en: bentuk(en) }
    hasil[kode] = { params: [...dipakai].sort(), ...entri }
  }
  return hasil
}

/** Label field yang dikenal pengguna, per bahasa. */
const label: Record<Bahasa, Record<string, string>> = {
  id: {
    'penjual.npwp': 'NPWP penjual',
    'penjual.nitku': 'NITKU penjual',
    tanggal: 'Tanggal faktur',
    kodeTransaksi: 'Kode transaksi',
    nomorFaktur: 'Nomor faktur',
    npwpPenjual: 'NPWP penjual',
    jumlahRetur: 'Jumlah barang retur',
    diskonRetur: 'Diskon retur',
    dppLain: 'DPP lain retur',
    'pembeli.npwp': 'NPWP pembeli',
    'pembeli.nitku': 'NITKU pembeli',
    'pembeli.nama': 'Nama pembeli',
    'pembeli.alamat': 'Alamat pembeli',
    'pembeli.jenisId': 'Jenis ID pembeli',
    nama: 'Nama barang/jasa',
    satuan: 'Satuan',
    harga: 'Harga satuan',
    jumlah: 'Jumlah',
    diskon: 'Diskon',
    tarifPpn: 'Tarif PPN',
    tarifPpnbm: 'Tarif PPnBM',
    dpp: 'DPP',
    dppNilaiLain: 'DPP nilai lain',
    ppn: 'PPN',
    ppnbm: 'PPnBM',
  },
  en: {
    'penjual.npwp': 'Seller NPWP',
    'penjual.nitku': 'Seller NITKU',
    tanggal: 'Invoice date',
    kodeTransaksi: 'Transaction code',
    nomorFaktur: 'Invoice number',
    npwpPenjual: 'Seller NPWP',
    jumlahRetur: 'Returned quantity',
    diskonRetur: 'Return discount',
    dppLain: 'Return other tax base',
    'pembeli.npwp': 'Buyer NPWP',
    'pembeli.nitku': 'Buyer NITKU',
    'pembeli.nama': 'Buyer name',
    'pembeli.alamat': 'Buyer address',
    'pembeli.jenisId': 'Buyer ID type',
    nama: 'Item name',
    satuan: 'Unit',
    harga: 'Unit price',
    jumlah: 'Quantity',
    diskon: 'Discount',
    tarifPpn: 'VAT rate',
    tarifPpnbm: 'Luxury tax rate',
    dpp: 'Tax base',
    dppNilaiLain: 'Other tax base',
    ppn: 'VAT',
    ppnbm: 'Luxury tax',
  },
}

export function labelField(bahasa: Bahasa, field: string): string {
  const kunci = field.replace(/^item\[\d+\]\./, '')
  return label[bahasa][kunci] ?? field
}
