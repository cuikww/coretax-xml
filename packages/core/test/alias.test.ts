import { describe, expect, it } from 'vitest'
import {
  type BatchFakturKeluaran,
  type BatchFakturKeluaranEn,
  type FakturKeluaranEn,
  fakturKeluaran,
  type ItemFakturEn,
} from '../src/index.js'

const NOL16 = '0000000000000000'
const NOL22 = '0000000000000000000000'

const indonesia: BatchFakturKeluaran = {
  penjual: { npwp: NOL16, nitku: NOL22 },
  faktur: [
    {
      tanggal: '2026-10-01',
      kodeTransaksi: '04',
      referensi: 'INV-1',
      keteranganTambahan: undefined,
      pembeli: {
        jenisId: 'TIN',
        npwp: NOL16,
        nitku: NOL22,
        nama: 'PT Contoh',
        alamat: 'Jl. Contoh',
        email: 'a@contoh.test',
        negara: 'IDN',
      },
      item: [
        {
          jenis: 'jasa',
          kode: '000000',
          nama: 'Jasa',
          satuan: 'UM.0033',
          harga: 600000,
          jumlah: 2,
          diskon: 0,
        },
        { jenis: 'barang', nama: 'Barang', satuan: 'UM.0018', harga: 1000, jumlah: 3, tarifPpnbm: 10 },
      ],
    },
  ],
}

const inggris: BatchFakturKeluaranEn = {
  seller: { tin: NOL16, idtku: NOL22 },
  invoices: [
    {
      date: '2026-10-01',
      transactionCode: '04',
      reference: 'INV-1',
      buyer: {
        idType: 'TIN',
        tin: NOL16,
        idtku: NOL22,
        name: 'PT Contoh',
        address: 'Jl. Contoh',
        email: 'a@contoh.test',
        country: 'IDN',
      },
      items: [
        {
          type: 'service',
          code: '000000',
          name: 'Jasa',
          unit: 'UM.0033',
          price: 600000,
          quantity: 2,
          discount: 0,
        },
        { type: 'goods', name: 'Barang', unit: 'UM.0018', price: 1000, quantity: 3, luxuryTaxRate: 10 },
      ],
    },
  ],
}

const faktur0 = (b: BatchFakturKeluaranEn) => b.invoices[0] as FakturKeluaranEn
const item0 = (b: BatchFakturKeluaranEn) => faktur0(b).items[0] as ItemFakturEn

describe('nama field berbahasa Inggris (F1.1)', () => {
  it('menghasilkan XML yang sama persis dengan nama Indonesia', () => {
    expect(fakturKeluaran.build(inggris)).toBe(fakturKeluaran.build(indonesia))
  })

  it('validate dan analisis menerima nama Inggris; hasil hitung sama', () => {
    expect(fakturKeluaran.validate(inggris).valid).toBe(true)
    const a = fakturKeluaran.analisis(inggris).faktur[0]?.item[0]
    expect(a?.OtherTaxBase).toBe(110000000n)
    expect(fakturKeluaran.analisis(inggris).faktur[0]?.item[1]?.STLG).toBe(
      fakturKeluaran.analisis(indonesia).faktur[0]?.item[1]?.STLG,
    )
  })

  it('angka yang diisi sendiri memakai nama Inggris (taxBase, otherTaxBase, vat, luxuryTax) dan diperiksa strict', () => {
    const b: BatchFakturKeluaranEn = structuredClone(inggris)
    faktur0(b).items = [
      {
        type: 'service',
        name: 'Jasa',
        unit: 'UM.0033',
        price: 600000,
        quantity: 2,
        taxBase: 1200000,
        otherTaxBase: 1100000,
        vat: 132000,
        luxuryTax: 0,
      },
    ]
    expect(fakturKeluaran.validate(b, { hitung: 'strict' }).errors).toEqual([])
    item0(b).vat = 131000
    expect(fakturKeluaran.validate(b).errors.map((e) => e.code)).toEqual(['VAT_MISMATCH'])
  })

  it('campuran: tiap objek boleh berbeda bahasa; kunci Indonesia menang jika keduanya ada', () => {
    const campur = {
      penjual: { tin: NOL16, nitku: NOL22 },
      faktur: [
        {
          ...indonesia.faktur[0],
          buyer: undefined,
          pembeli: { ...indonesia.faktur[0]?.pembeli, name: 'diabaikan', nama: 'PT Menang' },
        },
      ],
    }
    const xml = fakturKeluaran.build(campur as never)
    expect(xml).toContain('<BuyerName>PT Menang</BuyerName>')
    expect(xml).not.toContain('diabaikan')
  })

  it('path field di hasil mengikuti bahasa: Inggris untuk bahasa en, Indonesia untuk id', () => {
    const rusak = structuredClone(inggris)
    faktur0(rusak).buyer.name = ''
    item0(rusak).price = 'abc'
    const en = fakturKeluaran.validate(rusak, { bahasa: 'en' }).errors
    expect(en.map((e) => e.field)).toEqual(['buyer.name', 'items[0].price'])
    expect(en[0]?.pesan).toBe('Buyer name is required.')
    const id = fakturKeluaran.validate(rusak).errors
    expect(id.map((e) => e.field)).toEqual(['pembeli.nama', 'item[0].harga'])
    expect(id[0]?.pesan).toBe('Nama pembeli wajib diisi.')
  })

  it('jenis item selain goods/service dan barang/jasa ditolak', () => {
    const b = structuredClone(inggris)
    ;(item0(b) as { type: string }).type = 'lain'
    expect(fakturKeluaran.validate(b).errors.map((e) => e.code)).toEqual(['ITEM_TYPE_UNKNOWN'])
  })

  it('buildStream menerima faktur berkunci Inggris', async () => {
    const hasil: string[] = []
    for await (const f of fakturKeluaran.buildStream({ penjual: inggris.seller, faktur: inggris.invoices }))
      hasil.push(f.isi)
    expect(hasil).toEqual([fakturKeluaran.build(indonesia)])
  })

  it('masukan sampah tidak membuat TypeError: tetap dilaporkan sebagai error validasi', () => {
    expect(fakturKeluaran.validate(undefined as never).valid).toBe(false)
    expect(fakturKeluaran.validate({ seller: 5, invoices: 'x' } as never).valid).toBe(false)
  })
})
