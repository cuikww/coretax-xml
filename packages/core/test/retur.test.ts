import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  type BatchReturFakturMasukan,
  CoretaxValidationError,
  fakturKeluaran,
  returMasukan,
} from '../src/index.js'

const resmi = readFileSync(
  fileURLToPath(new URL('../../../fixtures/djp/Sample Retur Faktur PM Template v.1.1.xml', import.meta.url)),
  'utf8',
)
const normal = (x: string) => x.replace(/^﻿/, '').replace(/>\s+</g, '><').trim()

/** Padanan data untuk sampel resmi DJP: 1 retur, 2 baris barang yang sama. */
function padanan(): BatchReturFakturMasukan {
  const baris = {
    jenis: 'barang' as const,
    nama: 'Barang',
    kode: '000000',
    jumlah: 1,
    satuan: 'UM.0033',
    harga: 10000,
    jumlahRetur: 1,
    ppn: 1100,
  }
  return {
    pembeli: { npwp: '1091031210912281' },
    retur: [
      {
        nomorFaktur: '04002500000348920',
        npwpPenjual: '1091031210912281',
        tanggal: '2025-02-27',
        item: [{ ...baris }, { ...baris }],
      },
    ],
  }
}
const kode = (b: BatchReturFakturMasukan) => returMasukan.validate(b).errors.map((e) => e.code)
const peringatan = (b: BatchReturFakturMasukan) => returMasukan.validate(b).warnings.map((e) => e.code)

describe('retur faktur masukan: sampel resmi DJP v1.1', () => {
  it('check() meloloskan sampel resmi tanpa error dan peringatan', () => {
    const h = returMasukan.check(resmi)
    expect(h.errors).toEqual([])
    expect(h.warnings).toEqual([])
    expect(h.schema).toBe('retur-masukan@2025.03')
  })

  it('build() dari data setara menghasilkan XML yang sama dengan sampel (selain indentasi)', () => {
    expect(normal(returMasukan.build(padanan()))).toBe(normal(resmi))
  })

  it('hasil build lolos check()', () => {
    expect(returMasukan.check(returMasukan.build(padanan())).valid).toBe(true)
  })

  it('file faktur keluaran bukan retur: XML_ROOT menyebut akar yang diharapkan', () => {
    const h = returMasukan.check('<TaxInvoiceBulk/>')
    expect(h.errors[0]?.pesan).toBe('Elemen akar harus <InputTaxInvoiceReturn>, ditemukan <TaxInvoiceBulk>.')
  })
})

describe('retur faktur masukan: validasi data', () => {
  it('menghitung total dokumen dari item dan DPP dari jumlah retur x harga - diskon', () => {
    const b = padanan()
    const item = b.retur[0]?.item[0]
    if (item) Object.assign(item, { jumlah: 5, jumlahRetur: 3, diskonRetur: 1000, ppn: 2000 })
    const a = returMasukan.analisis(b)
    expect(a.hasil.errors).toEqual([])
    expect(a.retur[0]?.item[0]?.dpp).toBe(2900000n) // 3 x 10000 - 1000 = 29000,00
    expect(a.retur[0]?.dpp).toBe(2900000n + 1000000n)
    expect(a.retur[0]?.ppn).toBe(200000n + 110000n)
  })

  it('nomor faktur, NPWP, tanggal, satuan, jenis, kode barang', () => {
    const b = padanan()
    Object.assign(b.retur[0] ?? {}, { nomorFaktur: '123', npwpPenjual: '9', tanggal: '2025-02-30' })
    Object.assign(b.retur[0]?.item[0] ?? {}, { satuan: 'UM.9999', jenis: 'x', kode: '12' })
    expect(kode(b)).toEqual([
      'INVOICE_NUMBER_FORMAT',
      'NPWP_FORMAT',
      'DATE_FORMAT',
      'ITEM_TYPE_UNKNOWN',
      'GOODS_CODE_FORMAT',
      'UNIT_UNKNOWN',
    ])
  })

  it('jumlah retur melebihi jumlah faktur asal atau nol', () => {
    const b = padanan()
    Object.assign(b.retur[0]?.item[0] ?? {}, { jumlahRetur: 2 })
    Object.assign(b.retur[0]?.item[1] ?? {}, { jumlahRetur: 0 })
    expect(kode(b)).toEqual(['RETUR_QTY_EXCEEDS', 'QTY_ZERO'])
  })

  it('flag DPP lain: tidak dipakai -> nilainya harus sama dengan DPP; dipakai -> wajib diisi', () => {
    const b = padanan()
    Object.assign(b.retur[0]?.item[0] ?? {}, { dppLain: 9000 })
    expect(kode(b)).toEqual(['RETUR_OTHER_BASE_MISMATCH'])
    const c = padanan()
    Object.assign(c.retur[0]?.item[0] ?? {}, { pakaiDppLain: true })
    expect(kode(c)).toEqual(['REQUIRED'])
    const d = padanan()
    Object.assign(d.retur[0]?.item[0] ?? {}, { pakaiDppLain: true, dppLain: 9167 })
    const hasil = returMasukan.analisis(d)
    expect(hasil.hasil.errors).toEqual([])
    expect(hasil.retur[0]?.dppLain).toBe(916700n + 1000000n)
  })

  it('PPN wajib diisi: tarif tidak ada di template retur, jadi tidak dihitung', () => {
    const b = padanan()
    const item = b.retur[0]?.item[0]
    if (item) item.ppn = undefined as never
    const e = returMasukan.validate(b).errors[0]
    expect(e?.code).toBe('REQUIRED')
    expect(e?.pesan).toBe('PPN wajib diisi.')
  })

  it('selisih DPP dan total dokumen hanya peringatan (aturan DJP belum terkonfirmasi)', () => {
    const b = padanan()
    Object.assign(b.retur[0]?.item[0] ?? {}, { dpp: 9000 })
    Object.assign(b.retur[0] ?? {}, { ppn: 9999 })
    expect(kode(b)).toEqual([])
    expect(peringatan(b)).toEqual(['RETUR_DPP_MISMATCH', 'RETUR_TOTAL_MISMATCH'])
  })

  it('batch kosong, retur tanpa item, build melempar CoretaxValidationError', () => {
    expect(kode({ pembeli: { npwp: '1091031210912281' }, retur: [] })).toEqual(['RETUR_EMPTY'])
    const b = padanan()
    if (b.retur[0]) b.retur[0].item = []
    expect(kode(b)).toEqual(['ITEMS_EMPTY'])
    expect(() => returMasukan.build(b)).toThrow(CoretaxValidationError)
  })

  it('skema yang tidak ada dan pesan bahasa Inggris', () => {
    expect(returMasukan.validate(padanan(), { schema: '1999.01' }).errors.map((e) => e.code)).toEqual([
      'SCHEMA_UNKNOWN',
    ])
    const b = padanan()
    Object.assign(b.retur[0] ?? {}, { nomorFaktur: '1' })
    expect(returMasukan.validate(b, { bahasa: 'en' }).errors[0]?.pesan).toBe(
      'Invoice number "1" must be 17 digits.',
    )
  })
})

describe('retur faktur masukan: total dokumen dalam rupiah utuh (seperti converter DJP)', () => {
  it('total dokumen dan FooterRow dibulatkan, nilai per baris tetap berdesimal; tanpa peringatan selisih', () => {
    const b = padanan()
    const item = b.retur[0]?.item[0]
    if (item) Object.assign(item, { jumlah: 10.5, harga: 14500.5, jumlahRetur: 2.5, ppn: 4350.15 })
    if (b.retur[0]) b.retur[0].item = item ? [item] : []
    const h = returMasukan.validate(b)
    expect(h.errors).toEqual([])
    expect(h.warnings).toEqual([])
    const xml = returMasukan.build(b)
    expect(xml).toContain('<ReturnTaxBase>36251.25</ReturnTaxBase>') // baris
    expect(xml).toContain('<ReturnTaxBase>36251</ReturnTaxBase>') // dokumen
    expect(xml).toContain('<ReturnVAT>4350</ReturnVAT>')
    expect(xml).toContain('<ReturnVATTotal>4350</ReturnVATTotal>')
    expect(returMasukan.check(xml).valid).toBe(true)
  })
})

describe('retur faktur masukan: check() pada XML rusak', () => {
  it('FooterRow berbeda dari nilai dokumen', () => {
    const h = returMasukan.check(resmi.replace('<ReturnVATTotal>2200', '<ReturnVATTotal>2300'))
    expect(h.errors.map((e) => [e.code, e.element, e.faktur])).toEqual([
      ['RETUR_FOOTER_MISMATCH', 'ReturnVATTotal', 1],
    ])
  })

  it('elemen hilang, urutan salah, FooterRow tidak di akhir, boolean salah', () => {
    expect(
      returMasukan.check(resmi.replace(/\s*<SellerTIN>[^<]*<\/SellerTIN>/, '')).errors.map((e) => e.code),
    ).toContain('XML_ELEMENT_MISSING')
    const tertukar = resmi.replace(/(<Type>A<\/Type>)(\s*)(<Name>Barang<\/Name>)/, '$3$2$1')
    expect(returMasukan.check(tertukar).errors.map((e) => e.code)).toEqual(['XML_ELEMENT_ORDER'])
    const pindah = resmi
      .replace(/\s*<FooterRow>[\s\S]*?<\/FooterRow>/, '')
      .replace('<TransactionDetailsData>', (m) => {
        const footer = resmi.match(/<FooterRow>[\s\S]*?<\/FooterRow>/)?.[0] ?? ''
        return `${m}${footer}`
      })
    expect(returMasukan.check(pindah).errors.map((e) => e.code)).toContain('XML_ELEMENT_ORDER')
    const salah = resmi.replace('<ReturnOtherTaxBaseCheck>false', '<ReturnOtherTaxBaseCheck>no')
    expect(returMasukan.check(salah).errors.map((e) => e.code)).toContain('RETUR_BOOL_FORMAT')
  })

  it('tanggal di XML harus DD-MM-YYYY', () => {
    const h = returMasukan.check(resmi.replace('27-02-2025', '2025-02-27'))
    expect(h.errors.map((e) => e.code)).toEqual(['RETUR_DATE_FORMAT'])
  })

  it('XML rusak', () => {
    expect(returMasukan.check('<a><b></a>').errors.map((e) => e.code)).toEqual(['XML_PARSE'])
  })

  it('faktur keluaran tetap menolak file retur', () => {
    expect(fakturKeluaran.check(resmi).errors.map((e) => e.code)).toEqual(['XML_ROOT'])
  })
})
