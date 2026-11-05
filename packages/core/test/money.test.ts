import fc from 'fast-check'
import { describe, expect, it } from 'vitest'
import {
  bagiBulat,
  FormatAngkaError,
  formatRupiah,
  formatXml,
  kali,
  keSen,
  persen,
  rasio,
} from '../src/money.js'

describe('keSen', () => {
  it('membaca number dan string', () => {
    expect(keSen(1200000)).toBe(120000000n)
    expect(keSen('1500.5')).toBe(150050n)
    expect(keSen('0.10')).toBe(10n)
    expect(keSen(0.1)).toBe(10n)
  })
  it('menolak lebih dari 2 desimal dan pemisah ribuan', () => {
    expect(() => keSen('1.234')).toThrow(FormatAngkaError)
    expect(() => keSen('1.000.000')).toThrow(FormatAngkaError)
    expect(() => keSen('1,5')).toThrow(FormatAngkaError)
  })
  it('0.1 + 0.2 tidak bermasalah', () => {
    expect(keSen(0.1) + keSen(0.2)).toBe(keSen(0.3))
  })
})

describe('pembulatan', () => {
  it('setengah ke atas', () => {
    expect(bagiBulat(5n, 10n)).toBe(1n)
    expect(bagiBulat(4n, 10n)).toBe(0n)
    expect(bagiBulat(-5n, 10n)).toBe(-1n)
  })
  it('kali, persen, rasio', () => {
    expect(kali(keSen(600000), keSen(2))).toBe(keSen(1200000))
    expect(persen(keSen(1100000), keSen(12))).toBe(keSen(132000))
    expect(rasio(keSen(1200000), 11n, 12n)).toBe(keSen(1100000))
  })
})

describe('format', () => {
  it('XML tanpa pemisah ribuan dan tanpa nol di belakang', () => {
    expect(formatXml(120000000n)).toBe('1200000')
    expect(formatXml(150050n)).toBe('1500.5')
    expect(formatXml(1n)).toBe('0.01')
  })
  it('Rupiah untuk pesan', () => {
    expect(formatRupiah(13250000n)).toBe('132.500')
    expect(formatRupiah(916758n)).toBe('9.167,58')
  })
})

describe('properti', () => {
  const sen = fc.bigInt({ min: 0n, max: 10n ** 13n })

  it('formatXml lalu keSen kembali ke nilai semula', () => {
    fc.assert(fc.property(sen, (s) => keSen(formatXml(s)) === s))
  })

  it('DPP nilai lain 11/12 tidak pernah melebihi DPP, dan PPN selisih paling banyak 1 sen dari nilai eksak', () => {
    fc.assert(
      fc.property(sen, (dpp) => {
        const nl = rasio(dpp, 11n, 12n)
        const ppn = persen(nl, 1200n)
        // nilai eksak x 10000: nl * 1200
        const eksakX10000 = nl * 1200n
        return nl <= dpp && ppn * 10000n - eksakX10000 <= 5000n && eksakX10000 - ppn * 10000n <= 5000n
      }),
    )
  })
})
