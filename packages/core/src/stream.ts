import type { FakturKeluaranEn, PenjualEn } from './alias.js'
import { analisis, CoretaxValidationError } from './faktur-keluaran.js'
import type { FakturKeluaran, MasalahValidasi, OpsiValidasi, Penjual } from './types.js'
import { tulisXml } from './xml.js'

export interface SumberFaktur {
  penjual: Penjual | PenjualEn
  /** Array, generator, atau stream: faktur dibaca satu per satu dan tidak pernah ditahan lebih dari satu file. */
  faktur: Iterable<FakturKeluaran | FakturKeluaranEn> | AsyncIterable<FakturKeluaran | FakturKeluaranEn>
}

export interface OpsiStream extends OpsiValidasi {
  /** Jumlah faktur maksimal per file XML. Default 1000. */
  maksPerFile?: number
  /** Awalan nama file hasil. Default "faktur-keluaran" (hasil: faktur-keluaran-0001.xml). */
  awalanNama?: string
}

export interface BerkasXml {
  /** Mis. "faktur-keluaran-0001.xml". */
  nama: string
  isi: string
  /** Nomor file, mulai dari 1. */
  nomor: number
  jumlahFaktur: number
  /** Nomor faktur pertama di file ini dalam seluruh sumber, mulai dari 1. */
  nomorFakturAwal: number
  peringatan: MasalahValidasi[]
}

/**
 * Buat XML faktur pajak keluaran dalam potongan, tanpa memuat seluruh sumber ke memori. Setiap file divalidasi
 * dan dihitung sendiri; nomor faktur di error tetap nomor dalam seluruh sumber. Melempar CoretaxValidationError
 * saat file yang bermasalah tiba: file sebelumnya sudah diserahkan ke pemanggil.
 *
 * Batas jumlah faktur per impor di Coretax belum diketahui (pertanyaan terbuka di docs/PRD.md), jadi default
 * 1000 hanyalah angka aman, bukan aturan DJP.
 */
export async function* buildStream(sumber: SumberFaktur, opsi: OpsiStream = {}): AsyncGenerator<BerkasXml> {
  const maks = opsi.maksPerFile ?? 1000
  if (!Number.isInteger(maks) || maks < 1) throw new RangeError('maksPerFile harus bilangan bulat >= 1')
  const awalan = opsi.awalanNama ?? 'faktur-keluaran'
  let buf: (FakturKeluaran | FakturKeluaranEn)[] = []
  let nomor = 0
  let terkirim = 0

  const keluarkan = (): BerkasXml => {
    const a = analisis({ penjual: sumber.penjual, faktur: buf }, opsi, terkirim)
    if (!a.hasil.valid) throw new CoretaxValidationError(a.hasil)
    nomor++
    const berkas: BerkasXml = {
      nama: `${awalan}-${String(nomor).padStart(4, '0')}.xml`,
      isi: tulisXml(a.tin, a.faktur),
      nomor,
      jumlahFaktur: buf.length,
      nomorFakturAwal: terkirim + 1,
      peringatan: a.hasil.warnings,
    }
    terkirim += buf.length
    buf = []
    return berkas
  }

  for await (const f of sumber.faktur) {
    buf.push(f)
    if (buf.length >= maks) yield keluarkan()
  }
  // Sisa, atau sumber kosong (nomor = 0): analisis melaporkan FAKTUR_EMPTY dan melempar
  if (buf.length > 0 || nomor === 0) yield keluarkan()
}
