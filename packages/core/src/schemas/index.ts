import * as v2025_09 from './faktur-keluaran/v2025-09.js'

export type SkemaFakturKeluaran = typeof v2025_09

/** Semua skema faktur keluaran, urut dari yang paling lama. Skema yang sudah dirilis tidak pernah diubah. */
export const skemaFakturKeluaran: readonly SkemaFakturKeluaran[] = [v2025_09]

export interface PilihanSkema {
  skema: SkemaFakturKeluaran | null
  /** true jika tanggal faktur lebih awal dari skema paling lama. */
  sebelumBerlaku: boolean
}

/** Pilih skema berdasarkan id, atau 'auto' = skema terbaru yang sudah berlaku pada tanggal faktur. */
export function pilihSkema(id: string, tanggal: string | undefined): PilihanSkema {
  if (id !== 'auto') {
    return { skema: skemaFakturKeluaran.find((s) => s.meta.id === id) ?? null, sebelumBerlaku: false }
  }
  const berlaku = skemaFakturKeluaran.filter((s) => !tanggal || s.meta.berlakuMulai <= tanggal)
  const terbaru = berlaku.at(-1)
  if (terbaru) return { skema: terbaru, sebelumBerlaku: false }
  return { skema: skemaFakturKeluaran[0] ?? null, sebelumBerlaku: true }
}

export const daftarSkema = () => skemaFakturKeluaran.map((s) => s.meta)
