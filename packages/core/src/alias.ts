import type { Angka, BatchFakturKeluaran, FakturKeluaran, JenisId, KodeTransaksi, Penjual } from './types.js'

/**
 * Nama field berbahasa Inggris (PRD F1.1): `buyer.tin` untuk `pembeli.npwp`, dan seterusnya. Dipakai di semua
 * fungsi yang menerima batch faktur keluaran; diterjemahkan ke model Indonesia sebelum validasi.
 */
export interface PenjualEn {
  /** NPWP penjual, 16 digit. Ditulis ke `TIN`. */
  tin: string
  /** NITKU penjual, 22 digit. Ditulis ke `SellerIDTKU`. */
  idtku: string
}

export interface PembeliEn {
  idType: JenisId
  tin?: string
  idtku?: string
  documentNumber?: string
  name: string
  address: string
  email?: string
  /** Kode negara 3 huruf. Default 'IDN'. */
  country?: string
}

export interface ItemFakturEn {
  type: 'goods' | 'service'
  code?: string
  name: string
  unit: string
  price: Angka
  quantity: Angka
  discount?: Angka
  vatRate?: Angka
  luxuryTaxRate?: Angka
  taxBase?: Angka
  otherTaxBase?: Angka
  vat?: Angka
  luxuryTax?: Angka
}

export interface FakturKeluaranEn {
  /** YYYY-MM-DD */
  date: string
  transactionCode: KodeTransaksi
  reference?: string
  additionalInfo?: string
  supportingDocument?: string
  /** MMYYYY */
  supportingDocumentPeriod?: string
  facilityStamp?: string
  buyer: PembeliEn
  items: ItemFakturEn[]
}

export interface BatchFakturKeluaranEn {
  seller: PenjualEn
  invoices: FakturKeluaranEn[]
}

/** Campuran: tiap objek boleh memakai nama Indonesia atau Inggris (kunci Indonesia menang jika keduanya ada). */
export interface BatchFakturKeluaranCampur {
  penjual: Penjual | PenjualEn
  faktur: (FakturKeluaran | FakturKeluaranEn)[]
}

export type MasukanBatchFaktur = BatchFakturKeluaran | BatchFakturKeluaranEn | BatchFakturKeluaranCampur

const BATCH = { seller: 'penjual', invoices: 'faktur' }
const PENJUAL = { tin: 'npwp', idtku: 'nitku' }
const FAKTUR = {
  date: 'tanggal',
  transactionCode: 'kodeTransaksi',
  reference: 'referensi',
  additionalInfo: 'keteranganTambahan',
  supportingDocument: 'dokumenPendukung',
  supportingDocumentPeriod: 'periodeDokumenPendukung',
  facilityStamp: 'capFasilitas',
  buyer: 'pembeli',
  items: 'item',
}
const PEMBELI = {
  idType: 'jenisId',
  tin: 'npwp',
  idtku: 'nitku',
  documentNumber: 'nomorDokumen',
  country: 'negara',
  name: 'nama',
  address: 'alamat',
}
const ITEM = {
  type: 'jenis',
  code: 'kode',
  name: 'nama',
  unit: 'satuan',
  price: 'harga',
  quantity: 'jumlah',
  discount: 'diskon',
  vatRate: 'tarifPpn',
  luxuryTaxRate: 'tarifPpnbm',
  taxBase: 'dpp',
  otherTaxBase: 'dppNilaiLain',
  vat: 'ppn',
  luxuryTax: 'ppnbm',
}
const JENIS_ITEM: Record<string, string> = { goods: 'barang', service: 'jasa' }

const adaObjek = (x: unknown): x is Record<string, unknown> =>
  typeof x === 'object' && x !== null && !Array.isArray(x)

/** Salin objek dengan kunci Inggris diganti kunci Indonesia; jika kunci Indonesia sudah ada, nilai Inggris diabaikan. */
function peta(obj: unknown, kamus: Record<string, string>): unknown {
  if (!adaObjek(obj)) return obj
  const hasil: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    const id = kamus[k]
    if (id === undefined) hasil[k] = v
    else if (!(id in obj)) hasil[id] = v
  }
  return hasil
}

function normItem(item: unknown): unknown {
  const m = peta(item, ITEM)
  if (adaObjek(m) && typeof m.jenis === 'string' && m.jenis in JENIS_ITEM) m.jenis = JENIS_ITEM[m.jenis]
  return m
}

function normFaktur(faktur: unknown): unknown {
  const m = peta(faktur, FAKTUR)
  if (!adaObjek(m)) return m
  return {
    ...m,
    pembeli: peta(m.pembeli, PEMBELI),
    item: Array.isArray(m.item) ? m.item.map(normItem) : m.item,
  }
}

/** Terjemahkan batch berkunci Inggris (atau campuran) ke model Indonesia. Masukan yang bukan objek dikembalikan apa adanya. */
export function normalisasi(batch: unknown): BatchFakturKeluaran {
  const b = peta(batch, BATCH)
  if (!adaObjek(b)) return b as BatchFakturKeluaran
  return {
    ...b,
    penjual: peta(b.penjual, PENJUAL),
    faktur: Array.isArray(b.faktur) ? b.faktur.map(normFaktur) : b.faktur,
  } as BatchFakturKeluaran
}

const balik = (kamus: Record<string, string>) =>
  Object.fromEntries(Object.entries(kamus).map(([en, id]) => [id, en]))
const KE_EN = {
  batch: balik(BATCH),
  penjual: balik(PENJUAL),
  faktur: balik(FAKTUR),
  pembeli: balik(PEMBELI),
  item: balik(ITEM),
}

/** Path field model Indonesia ke Inggris: `pembeli.nama` -> `buyer.name`, `item[0].harga` -> `items[0].price`. */
export function fieldInggris(path: string): string {
  const item = /^item\[(\d+)\]\.(.+)$/.exec(path)
  if (item) return `items[${item[1]}].${KE_EN.item[item[2] as string] ?? item[2]}`
  const [kepala, ...sisa] = path.split('.')
  if (sisa.length > 0) {
    const bagian = sisa.join('.')
    if (kepala === 'pembeli') return `buyer.${KE_EN.pembeli[bagian] ?? bagian}`
    if (kepala === 'penjual') return `seller.${KE_EN.penjual[bagian] ?? bagian}`
    return path
  }
  return KE_EN.faktur[path] ?? KE_EN.batch[path] ?? path
}
