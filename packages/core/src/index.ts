/**
 * coretax-xml: buat dan validasi file XML impor Coretax DJP.
 *
 * Bukan produk DJP dan bukan nasihat pajak. Semua proses berjalan lokal:
 * library ini tidak melakukan panggilan jaringan.
 */
import { bupot21 as _bupot21, bupot26 as _bupot26 } from './bupot.js'
import { analisis, build, validate } from './faktur-keluaran.js'
import { type EntriKatalog, katalogError } from './messages.js'
import * as retur from './retur-masukan.js'
import * as skemaBp21 from './schemas/bupot/bp21-v2025-04.js'
import * as skemaBp26 from './schemas/bupot/bp26-v2024-12.js'
import { jenisDokumen } from './schemas/bupot/umum.js'
import * as skema2025_09 from './schemas/faktur-keluaran/v2025-09.js'
import { daftarSkema } from './schemas/index.js'
import * as skemaRetur from './schemas/retur-masukan/v2025-03.js'
import { buildStream, buildStreamRetur } from './stream.js'
import { check } from './xml-baca.js'

export type {
  BatchFakturKeluaranCampur,
  BatchFakturKeluaranEn,
  BatchReturFakturMasukanCampur,
  BatchReturFakturMasukanEn,
  FakturKeluaranEn,
  ItemFakturEn,
  ItemReturEn,
  PembeliEn,
  PenjualEn,
  ReturFakturMasukanEn,
} from './alias.js'
export type {
  AnalisisBupot,
  BarisBupot,
  BatchBupot21,
  BatchBupot26,
  Bupot21,
  Bupot26,
  Pemotong,
} from './bupot.js'
export type {
  Analisis,
  FakturTerhitung,
  ItemTerhitung,
} from './faktur-keluaran.js'
export { CoretaxValidationError, samarkan } from './faktur-keluaran.js'
export { formatRupiah, formatXml, keSen } from './money.js'
export type { MetaSkema } from './schemas/faktur-keluaran/v2025-09.js'
export type { BerkasXml, OpsiStream, SumberFaktur, SumberRetur } from './stream.js'
export type * from './types.js'
export type { EntriKatalog }
export { katalogError }

/** Faktur pajak keluaran (root XML `TaxInvoiceBulk`). */
export const fakturKeluaran = {
  /** Validasi tanpa membuat XML. */
  validate,
  /** Buat string XML; melempar CoretaxValidationError jika ada error. */
  build,
  /** Validasi + hasil hitung (DPP, DPP nilai lain, PPN) per item, untuk ditampilkan di aplikasi. */
  analisis,
  /** Buat XML per potongan (maksPerFile faktur) dari sumber yang bisa sangat besar; lihat OpsiStream. */
  buildStream,
  /** Periksa file XML yang sudah ada: struktur, lalu isi dan hitungan (seperti validate mode strict). */
  check,
  /** Daftar skema yang tersedia. */
  schemas: daftarSkema,
}

export type {
  AnalisisRetur,
  BatchReturFakturMasukan,
  ItemRetur,
  ReturFakturMasukan,
} from './retur-masukan.js'
export type { MetaSkemaRetur } from './schemas/retur-masukan/v2025-03.js'

/**
 * Retur faktur pajak masukan (root XML `InputTaxInvoiceReturn`).
 * Dalam hasil validasi, `faktur` berarti nomor retur (retur ke-n).
 */
export const returMasukan = {
  validate: retur.validate,
  build: retur.build,
  /** Buat XML per potongan (maksPerFile retur); lihat OpsiStream. */
  buildStream: buildStreamRetur,
  analisis: retur.analisis,
  check: retur.check,
  schemas: () => [skemaRetur.meta],
}

/**
 * Bukti potong PPh Pasal 21 (root XML `Bp21Bulk`). Deemed dan tarif yang kosong diisi dari sheet REF dan rumus
 * template DJP BP21 v.4 (TER, Pasal 17, harian, pesangon, pensiun). Dalam hasil validasi, `faktur` berarti nomor
 * bukti potong.
 */
export const bupot21 = _bupot21

/** Bukti potong PPh Pasal 26 (root XML `BP26Bulk`), untuk penerima penghasilan luar negeri. */
export const bupot26 = _bupot26

/** Tabel referensi untuk mengisi dropdown di aplikasi. */
export const referensi = {
  kodeTransaksi: () => ({ ...skema2025_09.kodeTransaksi }),
  satuan: () => Object.entries(skema2025_09.satuan).map(([kode, nama]) => ({ kode, nama })),
  jenisId: () => [...skema2025_09.jenisId],
  /** Keterangan tambahan untuk kode transaksi 07 atau 08. */
  keteranganTambahan: (kode: '07' | '08') => ({ ...skema2025_09.keteranganTambahan[kode] }),
  /** Cap fasilitas untuk kode transaksi 07 atau 08. */
  capFasilitas: (kode: '07' | '08') => ({ ...skema2025_09.capFasilitas[kode] }),
  negara: () => ({ ...skema2025_09.negara }),
  /** Daftar untuk bukti potong PPh 21 dan 26. */
  bupot: {
    jenisDokumen: () => ({ ...jenisDokumen }),
    statusPtkp: () => [...skemaBp21.statusPtkp],
    kodeObjekPajak21: () => ({ ...skemaBp21.kodeObjekPajak }),
    kodeObjekPajak26: () => ({ ...skemaBp26.kodeObjekPajak }),
    fasilitas21: () => ({ ...skemaBp21.fasilitas }),
    fasilitas26: () => ({ ...skemaBp26.fasilitas }),
  },
}
