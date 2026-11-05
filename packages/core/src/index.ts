/**
 * coretax-xml: buat dan validasi file XML impor Coretax DJP.
 *
 * Bukan produk DJP dan bukan nasihat pajak. Semua proses berjalan lokal:
 * library ini tidak melakukan panggilan jaringan.
 */
import { analisis, build, validate } from './faktur-keluaran.js'
import * as skema2025_09 from './schemas/faktur-keluaran/v2025-09.js'
import { daftarSkema } from './schemas/index.js'

export type {
  Analisis,
  FakturTerhitung,
  ItemTerhitung,
} from './faktur-keluaran.js'
export { CoretaxValidationError, samarkan } from './faktur-keluaran.js'
export { formatRupiah, formatXml, keSen } from './money.js'
export type { MetaSkema } from './schemas/faktur-keluaran/v2025-09.js'
export type * from './types.js'

/** Faktur pajak keluaran (root XML `TaxInvoiceBulk`). */
export const fakturKeluaran = {
  /** Validasi tanpa membuat XML. */
  validate,
  /** Buat string XML; melempar CoretaxValidationError jika ada error. */
  build,
  /** Validasi + hasil hitung (DPP, DPP nilai lain, PPN) per item, untuk ditampilkan di aplikasi. */
  analisis,
  /** Daftar skema yang tersedia. */
  schemas: daftarSkema,
}

/** Tabel referensi untuk mengisi dropdown di aplikasi. */
export const referensi = {
  kodeTransaksi: () => ({ ...skema2025_09.kodeTransaksi }),
  satuan: () => Object.entries(skema2025_09.satuan).map(([kode, nama]) => ({ kode, nama })),
  jenisId: () => [...skema2025_09.jenisId],
}
