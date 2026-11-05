/**
 * Aritmetika fixed-point dalam satuan sen (1/100) dengan BigInt,
 * supaya tidak ada error floating point JavaScript (0.1 + 0.2).
 */
import type { Angka } from './types.js'

export type Sen = bigint

export class FormatAngkaError extends Error {
  constructor(
    public readonly alasan: 'format' | 'desimal',
    nilai: string,
  ) {
    super(`Angka tidak valid: ${nilai}`)
  }
}

const POLA = /^-?\d+(\.\d+)?$/

/** Ubah number/string ke sen. Menolak lebih dari 2 desimal dan format selain titik desimal. */
export function keSen(nilai: Angka): Sen {
  const teks = typeof nilai === 'number' ? angkaKeTeks(nilai) : nilai.trim()
  if (!POLA.test(teks)) throw new FormatAngkaError('format', teks)
  const negatif = teks.startsWith('-')
  const [bulat, pecahan = ''] = (negatif ? teks.slice(1) : teks).split('.')
  if (pecahan.replace(/0+$/, '').length > 2) throw new FormatAngkaError('desimal', teks)
  const sen = BigInt(bulat ?? '0') * 100n + BigInt(pecahan.padEnd(2, '0').slice(0, 2))
  return negatif ? -sen : sen
}

function angkaKeTeks(n: number): string {
  if (!Number.isFinite(n)) return String(n)
  // toString bisa menghasilkan notasi eksponen untuk angka sangat besar/kecil
  const t = String(n)
  if (!/e/i.test(t)) return t
  return n.toFixed(20).replace(/\.?0+$/, '')
}

/** Bagi dengan pembulatan setengah ke atas (menjauhi nol). */
export function bagiBulat(pembilang: bigint, penyebut: bigint): bigint {
  if (penyebut <= 0n) throw new RangeError('penyebut harus positif')
  const negatif = pembilang < 0n
  const p = negatif ? -pembilang : pembilang
  const hasil = (p * 2n + penyebut) / (penyebut * 2n)
  return negatif ? -hasil : hasil
}

/** a x b, keduanya dalam sen, hasil dibulatkan ke sen. */
export function kali(a: Sen, b: Sen): Sen {
  return bagiBulat(a * b, 100n)
}

/** nilai x persen / 100, hasil dibulatkan ke sen. persen juga dalam sen (12% = 1200n). */
export function persen(nilai: Sen, tarif: Sen): Sen {
  return bagiBulat(nilai * tarif, 10000n)
}

/** nilai x pembilang / penyebut, dibulatkan ke sen. */
export function rasio(nilai: Sen, pembilang: bigint, penyebut: bigint): Sen {
  return bagiBulat(nilai * pembilang, penyebut)
}

/** Format sen untuk XML: tanpa pemisah ribuan, titik desimal, tanpa nol di belakang. 120000000n -> "1200000". */
export function formatXml(sen: Sen): string {
  const negatif = sen < 0n
  const s = negatif ? -sen : sen
  const bulat = s / 100n
  const pecahan = (s % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return `${negatif ? '-' : ''}${bulat}${pecahan ? `.${pecahan}` : ''}`
}

/** Format untuk pesan error: pemisah ribuan titik, desimal koma. 13250000n -> "132.500". */
export function formatRupiah(sen: Sen): string {
  const negatif = sen < 0n
  const s = negatif ? -sen : sen
  const bulat = (s / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const pecahan = (s % 100n).toString().padStart(2, '0').replace(/0+$/, '')
  return `${negatif ? '-' : ''}${bulat}${pecahan ? `,${pecahan}` : ''}`
}
