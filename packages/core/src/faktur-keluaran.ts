import { labelField, type Param, teks } from './messages.js'
import { FormatAngkaError, formatRupiah, kali, keSen, persen, rasio, type Sen } from './money.js'
import { pilihSkema, type SkemaFakturKeluaran } from './schemas/index.js'
import type {
  Angka,
  Bahasa,
  BatchFakturKeluaran,
  FakturKeluaran,
  HasilValidasi,
  ItemFaktur,
  KodeError,
  MasalahValidasi,
  OpsiValidasi,
} from './types.js'
import { tulisXml } from './xml.js'

/** Item yang sudah dinormalisasi dan dihitung, siap ditulis ke XML. */
export interface ItemTerhitung {
  Opt: 'A' | 'B'
  Code: string
  Name: string
  Unit: string
  Price: Sen
  Qty: Sen
  TotalDiscount: Sen
  TaxBase: Sen
  OtherTaxBase: Sen
  VATRate: Sen
  VAT: Sen
  STLGRate: Sen
  STLG: Sen
}

export interface FakturTerhitung {
  header: Record<string, string>
  item: ItemTerhitung[]
}

export interface Analisis {
  hasil: HasilValidasi
  tin: string
  faktur: FakturTerhitung[]
}

export class CoretaxValidationError extends Error {
  readonly hasil: HasilValidasi
  constructor(hasil: HasilValidasi) {
    const n = hasil.errors.length
    super(
      `Data faktur tidak valid: ${n} error. Error pertama: ${hasil.errors[0]?.pesan ?? '-'} ` +
        `(lihat error.hasil.errors untuk semua error).`,
    )
    this.name = 'CoretaxValidationError'
    this.hasil = hasil
  }
}

const DIGIT = /^\d+$/

/** Samarkan nomor identitas: 4 digit awal dan 4 digit akhir tetap terlihat. */
export function samarkan(nilai: string): string {
  if (nilai.length < 9) return '*'.repeat(nilai.length)
  return `${nilai.slice(0, 4)}${'*'.repeat(nilai.length - 8)}${nilai.slice(-4)}`
}

export function tanggalValid(t: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export class Pengumpul {
  readonly errors: MasalahValidasi[] = []
  readonly warnings: MasalahValidasi[] = []
  constructor(
    private readonly bahasa: Bahasa,
    private readonly sembunyikan: boolean,
  ) {}

  tambah(
    level: 'error' | 'warning',
    code: KodeError,
    lokasi: { faktur: number | null; item: number | null; field: string; element: string | null },
    param: Param = {},
    nilai?: string,
    rahasia = false,
  ) {
    const p: Param = { label: labelField(this.bahasa, lokasi.field), ...param }
    const { pesan, saran } = teks(this.bahasa, code, p)
    const masalah: MasalahValidasi = { code, level, ...lokasi, pesan }
    if (nilai !== undefined) masalah.nilai = rahasia && this.sembunyikan ? samarkan(nilai) : nilai
    if (saran) masalah.saran = saran
    ;(level === 'error' ? this.errors : this.warnings).push(masalah)
  }
}

export interface Lokasi {
  faktur: number | null
  item: number | null
  field: string
  element: string | null
}

export function bacaAngka(
  k: Pengumpul,
  nilai: Angka | undefined,
  lokasi: Lokasi,
  opsi: { wajib?: boolean; bawaan?: Angka } = {},
): Sen | null {
  if (nilai === undefined || nilai === null || nilai === '') {
    if (opsi.bawaan !== undefined) return keSen(opsi.bawaan)
    if (opsi.wajib) k.tambah('error', 'REQUIRED', lokasi)
    return null
  }
  try {
    const sen = keSen(nilai)
    if (sen < 0n) {
      k.tambah('error', 'NUMBER_NEGATIVE', lokasi, {}, String(nilai))
      return null
    }
    return sen
  } catch (e) {
    const code: KodeError =
      e instanceof FormatAngkaError && e.alasan === 'desimal' ? 'NUMBER_DECIMALS' : 'NUMBER_FORMAT'
    k.tambah('error', code, lokasi, { nilai: String(nilai) }, String(nilai))
    return null
  }
}

export function wajibTeks(k: Pengumpul, nilai: string | undefined, lokasi: Lokasi): string {
  const t = (nilai ?? '').trim()
  if (!t) k.tambah('error', 'REQUIRED', lokasi)
  return t
}

export function periksaDigit(
  k: Pengumpul,
  nilai: string | undefined,
  panjang: 16 | 22,
  lokasi: Lokasi,
): string {
  const t = (nilai ?? '').trim()
  if (!t) {
    k.tambah('error', 'REQUIRED', lokasi)
    return t
  }
  if (t.length !== panjang || !DIGIT.test(t)) {
    k.tambah('error', panjang === 16 ? 'NPWP_FORMAT' : 'NITKU_FORMAT', lokasi, { panjang: t.length }, t, true)
  }
  return t
}

function analisisItem(
  k: Pengumpul,
  s: SkemaFakturKeluaran,
  it: ItemFaktur,
  nf: number,
  ni: number,
  kodeTrx: string,
  strict: boolean,
): ItemTerhitung | null {
  const loc = (field: string, element: string | null): Lokasi => ({
    faktur: nf,
    item: ni,
    field: `item[${ni - 1}].${field}`,
    element,
  })

  let opt: 'A' | 'B' = 'A'
  if (it.jenis === 'barang') opt = 'A'
  else if (it.jenis === 'jasa') opt = 'B'
  else
    k.tambah('error', 'ITEM_TYPE_UNKNOWN', loc('jenis', 'Opt'), { nilai: String(it.jenis) }, String(it.jenis))

  let kode = (it.kode ?? '').trim()
  if (!kode) {
    kode = s.KODE_BARANG_DEFAULT
    k.tambah('warning', 'GOODS_CODE_DEFAULT', loc('kode', 'Code'))
  } else if (!/^\d{6}$/.test(kode)) {
    k.tambah('error', 'GOODS_CODE_FORMAT', loc('kode', 'Code'), { nilai: kode }, kode)
  }

  const nama = wajibTeks(k, it.nama, loc('nama', 'Name'))
  const satuan = (it.satuan ?? '').trim()
  if (!satuan) k.tambah('error', 'REQUIRED', loc('satuan', 'Unit'))
  else if (!(satuan in s.satuan)) {
    k.tambah('error', 'UNIT_UNKNOWN', loc('satuan', 'Unit'), { nilai: satuan, skema: s.meta.id }, satuan)
  }

  const harga = bacaAngka(k, it.harga, loc('harga', 'Price'), { wajib: true })
  const jumlah = bacaAngka(k, it.jumlah, loc('jumlah', 'Qty'), { wajib: true })
  const diskon = bacaAngka(k, it.diskon, loc('diskon', 'TotalDiscount'), { bawaan: 0 })
  const tarif = bacaAngka(k, it.tarifPpn, loc('tarifPpn', 'VATRate'), { bawaan: s.TARIF_PPN_DEFAULT })
  const tarifBm = bacaAngka(k, it.tarifPpnbm, loc('tarifPpnbm', 'STLGRate'), { bawaan: 0 })
  const dppInput = bacaAngka(k, it.dpp, loc('dpp', 'TaxBase'))
  const nlInput = bacaAngka(k, it.dppNilaiLain, loc('dppNilaiLain', 'OtherTaxBase'))
  const ppnInput = bacaAngka(k, it.ppn, loc('ppn', 'VAT'))
  const bmInput = bacaAngka(k, it.ppnbm, loc('ppnbm', 'STLG'))

  if (strict) {
    const wajib: [Angka | undefined, string, string][] = [
      [it.dpp, 'dpp', 'TaxBase'],
      [it.dppNilaiLain, 'dppNilaiLain', 'OtherTaxBase'],
      [it.ppn, 'ppn', 'VAT'],
      [it.ppnbm, 'ppnbm', 'STLG'],
    ]
    for (const [v, f, e] of wajib) {
      if (v === undefined || v === '') k.tambah('error', 'STRICT_VALUE_MISSING', loc(f, e))
    }
  }

  if (jumlah !== null && jumlah === 0n) k.tambah('error', 'QTY_ZERO', loc('jumlah', 'Qty'))
  if (harga === null || jumlah === null || diskon === null || tarif === null || tarifBm === null) return null

  const bruto = kali(harga, jumlah)
  if (diskon > bruto) {
    k.tambah('error', 'DISCOUNT_TOO_LARGE', loc('diskon', 'TotalDiscount'), {
      diskon: formatRupiah(diskon),
      total: formatRupiah(bruto),
    })
    return null
  }

  const dppHitung = bruto - diskon
  if (dppInput !== null && dppInput !== dppHitung) {
    k.tambah('error', 'DPP_MISMATCH', loc('dpp', 'TaxBase'), {
      nilai: formatRupiah(dppInput),
      harap: formatRupiah(dppHitung),
    })
  }
  const dpp = dppInput ?? dppHitung

  const dppNl = nlInput ?? (kodeTrx === '04' ? rasio(dpp, 11n, 12n) : dpp)
  if (dppNl > dpp) {
    k.tambah('error', 'DPP_NL_TOO_LARGE', loc('dppNilaiLain', 'OtherTaxBase'), {
      nilai: formatRupiah(dppNl),
      dpp: formatRupiah(dpp),
    })
  }

  const ppnHitung = persen(dppNl, tarif)
  if (ppnInput !== null && ppnInput !== ppnHitung && s.kodeDenganRumusPpn.has(kodeTrx)) {
    k.tambah('error', 'VAT_MISMATCH', loc('ppn', 'VAT'), {
      nilai: formatRupiah(ppnInput),
      tarif: formatRupiah(tarif),
      dppNl: formatRupiah(dppNl),
      harap: formatRupiah(ppnHitung),
    })
  }

  // Template DJP v1.6.1: PPnBM = tarif PPnBM x DPP nilai lain, dan "bisa diisi dengan nilai lain"
  const bmHitung = persen(dppNl, tarifBm)
  if (bmInput !== null && bmInput !== bmHitung) {
    k.tambah('warning', 'STLG_MISMATCH', loc('ppnbm', 'STLG'), {
      nilai: formatRupiah(bmInput),
      tarif: formatRupiah(tarifBm),
      dpp: formatRupiah(dppNl),
      harap: formatRupiah(bmHitung),
    })
  }

  return {
    Opt: opt,
    Code: kode,
    Name: nama,
    Unit: satuan,
    Price: harga,
    Qty: jumlah,
    TotalDiscount: diskon,
    TaxBase: dpp,
    OtherTaxBase: dppNl,
    VATRate: tarif,
    VAT: ppnInput ?? ppnHitung,
    STLGRate: tarifBm,
    STLG: bmInput ?? bmHitung,
  }
}

function analisisFaktur(
  k: Pengumpul,
  s: SkemaFakturKeluaran,
  f: FakturKeluaran,
  nf: number,
  nitkuPenjual: string,
  strict: boolean,
): FakturTerhitung {
  const loc = (field: string, element: string | null): Lokasi => ({ faktur: nf, item: null, field, element })
  const header: Record<string, string> = {}

  const tanggal = (f.tanggal ?? '').trim()
  if (!tanggal) k.tambah('error', 'REQUIRED', loc('tanggal', 'TaxInvoiceDate'))
  else if (!tanggalValid(tanggal)) {
    k.tambah('error', 'DATE_FORMAT', loc('tanggal', 'TaxInvoiceDate'), { nilai: tanggal }, tanggal)
  }

  const kodeTrx = String(f.kodeTransaksi ?? '').trim()
  if (!kodeTrx) k.tambah('error', 'REQUIRED', loc('kodeTransaksi', 'TrxCode'))
  else if (!(kodeTrx in s.kodeTransaksi)) {
    k.tambah('error', 'TRX_CODE_UNKNOWN', loc('kodeTransaksi', 'TrxCode'), { nilai: kodeTrx }, kodeTrx)
  }

  const addInfo = (f.keteranganTambahan ?? '').trim()
  const cap = (f.capFasilitas ?? '').trim()
  if (s.kodeWajibFasilitas.has(kodeTrx)) {
    if (!addInfo)
      k.tambah('error', 'ADDINFO_REQUIRED', loc('keteranganTambahan', 'AddInfo'), { kode: kodeTrx })
    if (!cap) k.tambah('error', 'FACILITY_REQUIRED', loc('capFasilitas', 'FacilityStamp'), { kode: kodeTrx })
  }
  // Daftar resmi hanya ada untuk 07 dan 08; kode lain dicek ke daftar 07 (yang paling lengkap)
  const kodeRef = kodeTrx === '08' ? '08' : '07'
  if (addInfo && !(addInfo in s.keteranganTambahan[kodeRef])) {
    k.tambah(
      'error',
      'ADDINFO_UNKNOWN',
      loc('keteranganTambahan', 'AddInfo'),
      { nilai: addInfo, kode: kodeRef },
      addInfo,
    )
  }
  if (cap && !(cap in s.capFasilitas[kodeRef])) {
    k.tambah(
      'error',
      'FACILITY_UNKNOWN',
      loc('capFasilitas', 'FacilityStamp'),
      { nilai: cap, kode: kodeRef },
      cap,
    )
  }

  const periode = (f.periodeDokumenPendukung ?? '').trim()
  if (periode && !/^(0[1-9]|1[0-2])\d{4}$/.test(periode)) {
    k.tambah('error', 'CUSTOM_DOC_PERIOD_FORMAT', loc('periodeDokumenPendukung', 'CustomDocMonthYear'), {
      nilai: periode,
    })
  }

  // Pembeli
  const p = f.pembeli ?? ({} as FakturKeluaran['pembeli'])
  const jenisId = p.jenisId
  if (!(s.jenisId as readonly string[]).includes(jenisId)) {
    k.tambah('error', 'BUYER_DOC_UNKNOWN', loc('pembeli.jenisId', 'BuyerDocument'), {
      nilai: String(jenisId),
    })
  }
  let buyerTin = s.BUYER_TIN_NOL
  let buyerIdtku = s.BUYER_IDTKU_NOL
  let nomorDokumen = '-'
  const nitkuPembeli = (p.nitku ?? '').trim()
  if (jenisId === 'TIN') {
    buyerTin = periksaDigit(k, p.npwp, 16, loc('pembeli.npwp', 'BuyerTin'))
    if (nitkuPembeli.length !== 22 || !DIGIT.test(nitkuPembeli)) {
      k.tambah(
        'error',
        'BUYER_IDTKU_MISMATCH',
        loc('pembeli.nitku', 'BuyerIDTKU'),
        { jenisId },
        nitkuPembeli,
        true,
      )
    }
    buyerIdtku = nitkuPembeli
  } else if (jenisId) {
    if (nitkuPembeli && nitkuPembeli !== s.BUYER_IDTKU_NOL) {
      k.tambah(
        'error',
        'BUYER_IDTKU_MISMATCH',
        loc('pembeli.nitku', 'BuyerIDTKU'),
        { jenisId },
        nitkuPembeli,
        true,
      )
    }
    if ((p.npwp ?? '').trim() && (p.npwp ?? '').trim() !== s.BUYER_TIN_NOL) {
      k.tambah('warning', 'BUYER_TIN_NOT_ALLOWED', loc('pembeli.npwp', 'BuyerTin'), { jenisId })
    }
    nomorDokumen = (p.nomorDokumen ?? '').trim()
    if (!nomorDokumen) {
      k.tambah('error', 'BUYER_DOC_NUMBER_REQUIRED', loc('pembeli.nomorDokumen', 'BuyerDocumentNumber'), {
        jenisId,
      })
    }
  }

  const nama = wajibTeks(k, p.nama, loc('pembeli.nama', 'BuyerName'))
  const alamat = wajibTeks(k, p.alamat, loc('pembeli.alamat', 'BuyerAdress'))
  const email = (p.email ?? '').trim()
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    k.tambah('warning', 'EMAIL_FORMAT', loc('pembeli.email', 'BuyerEmail'), { nilai: email })
  }
  const negara = (p.negara ?? 'IDN').trim()
  if (negara === 'IND') k.tambah('warning', 'COUNTRY_IND', loc('pembeli.negara', 'BuyerCountry'))
  else if (!(negara in s.negara)) {
    k.tambah('error', 'COUNTRY_UNKNOWN', loc('pembeli.negara', 'BuyerCountry'), { nilai: negara })
  }

  Object.assign(header, {
    TaxInvoiceDate: tanggal,
    TaxInvoiceOpt: 'Normal',
    TrxCode: kodeTrx,
    AddInfo: addInfo,
    CustomDoc: (f.dokumenPendukung ?? '').trim(),
    CustomDocMonthYear: periode,
    RefDesc: (f.referensi ?? '').trim(),
    FacilityStamp: cap,
    SellerIDTKU: nitkuPenjual,
    BuyerTin: buyerTin,
    BuyerDocument: jenisId,
    BuyerCountry: negara,
    BuyerDocumentNumber: nomorDokumen,
    BuyerName: nama,
    BuyerAdress: alamat,
    BuyerEmail: email,
    BuyerIDTKU: buyerIdtku,
  })

  const items: ItemTerhitung[] = []
  if (!Array.isArray(f.item) || f.item.length === 0) {
    k.tambah('error', 'ITEMS_EMPTY', loc('item', 'ListOfGoodService'))
  } else {
    f.item.forEach((it, i) => {
      const hasil = analisisItem(k, s, it, nf, i + 1, kodeTrx, strict)
      if (hasil) items.push(hasil)
    })
  }

  return { header, item: items }
}

/** `offset` (internal, dipakai buildStream): jumlah faktur sebelumnya, supaya nomor faktur di error tetap global. */
export function analisis(batch: BatchFakturKeluaran, opsi: OpsiValidasi = {}, offset = 0): Analisis {
  const bahasa = opsi.bahasa ?? 'id'
  const k = new Pengumpul(bahasa, opsi.samarkan ?? true)
  const daftar = Array.isArray(batch?.faktur) ? batch.faktur : []
  const { skema, sebelumBerlaku } = pilihSkema(opsi.schema ?? 'auto', daftar[0]?.tanggal)
  const idSkema = skema ? `faktur-keluaran@${skema.meta.id}` : `faktur-keluaran@${opsi.schema}`

  if (!skema) {
    k.tambah(
      'error',
      'SCHEMA_UNKNOWN',
      { faktur: null, item: null, field: 'opsi.schema', element: null },
      {
        nilai: String(opsi.schema),
      },
    )
    return {
      hasil: { valid: false, schema: idSkema, errors: k.errors, warnings: k.warnings },
      tin: '',
      faktur: [],
    }
  }
  if (sebelumBerlaku) {
    k.tambah(
      'warning',
      'SCHEMA_DATE_BEFORE',
      { faktur: 1, item: null, field: 'tanggal', element: 'TaxInvoiceDate' },
      {
        nilai: String(daftar[0]?.tanggal),
        skema: skema.meta.id,
      },
    )
  }

  const lokBatch = (field: string, element: string): Lokasi => ({ faktur: null, item: null, field, element })
  const tin = periksaDigit(k, batch?.penjual?.npwp, 16, lokBatch('penjual.npwp', 'TIN'))
  const nitkuPenjual = periksaDigit(k, batch?.penjual?.nitku, 22, lokBatch('penjual.nitku', 'SellerIDTKU'))

  if (daftar.length === 0) k.tambah('error', 'FAKTUR_EMPTY', lokBatch('faktur', 'ListOfTaxInvoice'))

  const strict = opsi.hitung === 'strict'
  const faktur = daftar.map((f, i) => analisisFaktur(k, skema, f, i + 1 + offset, nitkuPenjual, strict))

  return {
    hasil: { valid: k.errors.length === 0, schema: idSkema, errors: k.errors, warnings: k.warnings },
    tin,
    faktur,
  }
}

/** Validasi batch faktur tanpa membuat XML. Selalu mengembalikan semua error sekaligus. */
export function validate(batch: BatchFakturKeluaran, opsi: OpsiValidasi = {}): HasilValidasi {
  return analisis(batch, opsi).hasil
}

/** Buat XML impor Coretax. Melempar CoretaxValidationError jika data tidak valid. */
export function build(batch: BatchFakturKeluaran, opsi: OpsiValidasi = {}): string {
  const a = analisis(batch, opsi)
  if (!a.hasil.valid) throw new CoretaxValidationError(a.hasil)
  return tulisXml(a.tin, a.faktur)
}
