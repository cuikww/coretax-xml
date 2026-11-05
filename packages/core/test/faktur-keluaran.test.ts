import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  type BatchFakturKeluaran,
  CoretaxValidationError,
  type FakturKeluaran,
  fakturKeluaran,
  referensi,
  samarkan,
} from '../src/index.js'

const fixture = (nama: string) =>
  readFileSync(fileURLToPath(new URL(`../../../fixtures/faktur-keluaran/${nama}`, import.meta.url)), 'utf8')

const NOL16 = '0000000000000000'
const NOL22 = '0000000000000000000000'

function contoh(ubah: Partial<FakturKeluaran> = {}): BatchFakturKeluaran {
  return {
    penjual: { npwp: NOL16, nitku: NOL22 },
    faktur: [
      {
        tanggal: '2026-10-01',
        kodeTransaksi: '04',
        referensi: 'INV-2026-10-001',
        pembeli: {
          jenisId: 'TIN',
          npwp: NOL16,
          nitku: NOL22,
          nama: 'PT Contoh Pembeli',
          alamat: 'Jl. Contoh No. 1, Jakarta',
          email: 'finance@contoh.co.id',
        },
        item: [
          { jenis: 'jasa', nama: 'Jasa Konsultasi Sistem', satuan: 'UM.0033', harga: 600000, jumlah: 2 },
        ],
        ...ubah,
      },
    ],
  }
}

const kodeError = (b: BatchFakturKeluaran, opsi = {}) =>
  fakturKeluaran.validate(b, opsi).errors.map((e) => e.code)

describe('build', () => {
  it('menghasilkan XML yang sama persis dengan fixture sampel', () => {
    expect(fakturKeluaran.build(contoh())).toBe(fixture('contoh-jasa-kode-04.xml'))
  })

  it('isinya sama dengan sampel resmi DJP "Sample Faktur PK Template v.1.4.xml"', () => {
    const resmi = readFileSync(
      fileURLToPath(new URL('../../../fixtures/djp/Sample Faktur PK Template v.1.4.xml', import.meta.url)),
      'utf8',
    )
    const xml = fakturKeluaran.build({
      penjual: { npwp: '1091031210912281', nitku: '1091031210912281000000' },
      faktur: [
        {
          tanggal: '2025-02-02',
          kodeTransaksi: '07',
          keteranganTambahan: 'TD.00502',
          dokumenPendukung: '00004092893220241216000270',
          periodeDokumenPendukung: '122024',
          capFasilitas: 'TD.01102',
          pembeli: {
            jenisId: 'TIN',
            npwp: '1091031210912281',
            nitku: '1091031210912281000000',
            negara: 'IND',
            nama: 'PT Contoh',
            alamat: 'Jakarta',
            email: 'someemail@gmail.com',
          },
          item: [
            {
              jenis: 'barang',
              kode: '000000',
              nama: 'Barang',
              satuan: 'UM.0001',
              harga: 15000,
              jumlah: 200,
              diskon: 100000,
              tarifPpn: 11,
              tarifPpnbm: 20,
            },
          ],
        },
      ],
    })
    // Sampel v1.4 (Feb 2025) mengosongkan 3 field ini; template v1.6.1 mewajibkannya
    // ("-" untuk nomor dokumen pembeli TIN, nama dan alamat wajib).
    const bedaYangDiketahui = ['BuyerDocumentNumber', 'BuyerName', 'BuyerAdress']
    const daun = (x: string) =>
      [...x.matchAll(/<(\w+)(?:\/>|>([^<]*)<\/\1>)/g)]
        .filter((m) => !bedaYangDiketahui.includes(m[1] as string))
        .map((m) => `${m[1]}=${m[2] ?? ''}`)
    expect(daun(xml)).toEqual(daun(resmi))
  })

  it('melempar CoretaxValidationError berisi semua error', () => {
    const b = contoh({ tanggal: '2026-02-30', kodeTransaksi: '99' as never })
    try {
      fakturKeluaran.build(b)
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(CoretaxValidationError)
      const codes = (e as CoretaxValidationError).hasil.errors.map((x) => x.code)
      expect(codes).toContain('DATE_FORMAT')
      expect(codes).toContain('TRX_CODE_UNKNOWN')
    }
  })

  it('meng-escape karakter khusus XML di nama dan alamat', () => {
    const b = contoh()
    const f = b.faktur[0] as FakturKeluaran
    f.pembeli.nama = 'PT A & B <Jaya>'
    expect(fakturKeluaran.build(b)).toContain('<BuyerName>PT A &amp; B &lt;Jaya&gt;</BuyerName>')
  })

  it('mengisi nilai baku untuk pembeli National ID', () => {
    const xml = fakturKeluaran.build(
      contoh({
        kodeTransaksi: '01',
        pembeli: {
          jenisId: 'National ID',
          nomorDokumen: '5171014512990001',
          nama: 'Budi',
          alamat: 'Denpasar',
        },
      }),
    )
    expect(xml).toContain(`<BuyerTin>${NOL16}</BuyerTin>`)
    expect(xml).toContain('<BuyerIDTKU>000000</BuyerIDTKU>')
    expect(xml).toContain('<BuyerDocumentNumber>5171014512990001</BuyerDocumentNumber>')
  })
})

describe('hitung', () => {
  const item = (b: BatchFakturKeluaran) => fakturKeluaran.analisis(b).faktur[0]?.item[0]

  it('kode 04: DPP nilai lain = 11/12 DPP, PPN = 12% x DPP nilai lain', () => {
    const it0 = item(contoh())
    expect(it0?.TaxBase).toBe(120000000n)
    expect(it0?.OtherTaxBase).toBe(110000000n)
    expect(it0?.VAT).toBe(13200000n)
  })

  it('kode 01: DPP nilai lain sama dengan DPP', () => {
    const it0 = item(contoh({ kodeTransaksi: '01' }))
    expect(it0?.OtherTaxBase).toBe(it0?.TaxBase)
    expect(it0?.VAT).toBe(14400000n)
  })

  it('membulatkan ke 2 desimal, setengah ke atas', () => {
    const b = contoh({ item: [{ jenis: 'barang', nama: 'X', satuan: 'UM.0018', harga: 10001, jumlah: 1 }] })
    const it0 = item(b)
    // 10001 x 11/12 = 9167,5833 -> 9167,58 ; 12% x 9167,58 = 1100,1096 -> 1100,11
    expect(it0?.OtherTaxBase).toBe(916758n)
    expect(it0?.VAT).toBe(110011n)
  })

  it('diskon mengurangi DPP', () => {
    const b = contoh({
      kodeTransaksi: '01',
      item: [{ jenis: 'barang', nama: 'X', satuan: 'UM.0018', harga: '1500.50', jumlah: 3, diskon: 500 }],
    })
    expect(item(b)?.TaxBase).toBe(400150n)
  })
})

describe('validate', () => {
  it('data contoh valid, dengan peringatan kode barang default', () => {
    const h = fakturKeluaran.validate(contoh())
    expect(h.valid).toBe(true)
    expect(h.schema).toBe('faktur-keluaran@2025.09')
    expect(h.warnings.map((w) => w.code)).toEqual(['GOODS_CODE_DEFAULT'])
  })

  it('NPWP pembeli 15 digit ditolak, nilainya disamarkan', () => {
    const b = contoh()
    ;(b.faktur[0] as FakturKeluaran).pembeli.npwp = '012345678901234'
    const e = fakturKeluaran.validate(b).errors.find((x) => x.code === 'NPWP_FORMAT')
    expect(e?.field).toBe('pembeli.npwp')
    expect(e?.element).toBe('BuyerTin')
    expect(e?.pesan).toBe('NPWP pembeli harus 16 digit angka, ditemukan 15 karakter.')
    expect(e?.nilai).toBe('0123*******1234')
  })

  it('jenis ID TIN tanpa NITKU 22 digit: BUYER_IDTKU_MISMATCH (kasus dari artikel DDTC)', () => {
    const b = contoh()
    ;(b.faktur[0] as FakturKeluaran).pembeli.nitku = '000000'
    expect(kodeError(b)).toContain('BUYER_IDTKU_MISMATCH')
  })

  it('jenis ID National ID dengan NITKU 22 digit: BUYER_IDTKU_MISMATCH', () => {
    const b = contoh({
      pembeli: { jenisId: 'National ID', nomorDokumen: '1', nitku: NOL22, nama: 'A', alamat: 'B' },
    })
    expect(kodeError(b)).toContain('BUYER_IDTKU_MISMATCH')
  })

  it('jenis ID selain TIN wajib nomor dokumen', () => {
    const b = contoh({ pembeli: { jenisId: 'Passport', nama: 'A', alamat: 'B', negara: 'SGP' } })
    expect(kodeError(b)).toContain('BUYER_DOC_NUMBER_REQUIRED')
  })

  it('kode 07 wajib keterangan tambahan dan cap fasilitas', () => {
    const codes = kodeError(contoh({ kodeTransaksi: '07' }))
    expect(codes).toContain('ADDINFO_REQUIRED')
    expect(codes).toContain('FACILITY_REQUIRED')
    expect(
      kodeError(contoh({ kodeTransaksi: '07', keteranganTambahan: 'TD.00524', capFasilitas: 'TD.01113' })),
    ).toEqual([])
  })

  it('keterangan tambahan dan cap fasilitas dicek ke daftar resmi per kode transaksi', () => {
    // TD.00511 dan TD.01111 ada untuk kode 07, tidak untuk 08
    const ok07 = contoh({ kodeTransaksi: '07', keteranganTambahan: 'TD.00511', capFasilitas: 'TD.01111' })
    expect(kodeError(ok07)).toEqual([])
    const salah08 = contoh({ kodeTransaksi: '08', keteranganTambahan: 'TD.00511', capFasilitas: 'TD.01111' })
    expect(kodeError(salah08)).toEqual(['ADDINFO_UNKNOWN', 'FACILITY_UNKNOWN'])
  })

  it('kode negara dicek ke daftar resmi', () => {
    const b = contoh()
    ;(b.faktur[0] as FakturKeluaran).pembeli.negara = 'XYZ'
    expect(kodeError(b)).toEqual(['COUNTRY_UNKNOWN'])
    expect(referensi.negara().IDN).toBe('Indonesia')
  })

  it('PPnBM dihitung dari DPP nilai lain; nilai lain hanya peringatan', () => {
    const item = { jenis: 'barang' as const, nama: 'X', satuan: 'UM.0002', harga: 12000000, jumlah: 10 }
    const b = contoh({ item: [{ ...item, tarifPpnbm: 10 }] })
    expect(fakturKeluaran.analisis(b).faktur[0]?.item[0]?.STLG).toBe(1100000000n) // 10% x 110.000.000, dalam sen
    const h = fakturKeluaran.validate(contoh({ item: [{ ...item, tarifPpnbm: 10, ppnbm: 12000000 }] }))
    expect(h.valid).toBe(true)
    expect(h.warnings.map((w) => w.code)).toContain('STLG_MISMATCH')
  })

  it('negara IND diperingatkan sebagai India', () => {
    const b = contoh()
    ;(b.faktur[0] as FakturKeluaran).pembeli.negara = 'IND'
    expect(fakturKeluaran.validate(b).warnings.map((w) => w.code)).toContain('COUNTRY_IND')
  })

  it('satuan tidak dikenal ditolak dengan nama skema', () => {
    const b = contoh({ item: [{ jenis: 'barang', nama: 'X', satuan: 'UM.0040', harga: 1, jumlah: 1 }] })
    const e = fakturKeluaran.validate(b).errors.find((x) => x.code === 'UNIT_UNKNOWN')
    expect(e?.pesan).toBe('Satuan "UM.0040" tidak ada di skema 2025.09.')
    expect(e?.faktur).toBe(1)
    expect(e?.item).toBe(1)
  })

  it('angka dengan lebih dari 2 desimal atau pemisah ribuan ditolak', () => {
    const b = contoh({
      item: [
        { jenis: 'barang', nama: 'X', satuan: 'UM.0018', harga: '1.000.000', jumlah: 1 },
        { jenis: 'barang', nama: 'Y', satuan: 'UM.0018', harga: 1, jumlah: 0.125 },
      ],
    })
    const codes = kodeError(b)
    expect(codes).toContain('NUMBER_FORMAT')
    expect(codes).toContain('NUMBER_DECIMALS')
  })

  it('PPN yang diisi tapi salah: VAT_MISMATCH dengan angka format Rupiah', () => {
    const b = contoh({
      item: [{ jenis: 'jasa', nama: 'X', satuan: 'UM.0033', harga: 600000, jumlah: 2, ppn: 132500 }],
    })
    const e = fakturKeluaran.validate(b).errors.find((x) => x.code === 'VAT_MISMATCH')
    expect(e?.pesan).toBe('PPN 132.500 tidak sama dengan 12% x DPP nilai lain 1.100.000 = 132.000.')
  })

  it('mode strict mewajibkan semua angka', () => {
    expect(kodeError(contoh(), { hitung: 'strict' })).toContain('STRICT_VALUE_MISSING')
  })

  it('melaporkan semua error sekaligus, tidak berhenti di yang pertama', () => {
    const b: BatchFakturKeluaran = {
      penjual: { npwp: '123', nitku: '' },
      faktur: [contoh().faktur[0] as FakturKeluaran, { ...(contoh().faktur[0] as FakturKeluaran), item: [] }],
    }
    const h = fakturKeluaran.validate(b)
    expect(h.errors.map((e) => e.code)).toEqual(['NPWP_FORMAT', 'REQUIRED', 'ITEMS_EMPTY'])
    expect(h.errors[2]?.faktur).toBe(2)
  })

  it('pesan dalam bahasa Inggris', () => {
    const b = contoh({ kodeTransaksi: '07' })
    const e = fakturKeluaran.validate(b, { bahasa: 'en' }).errors[0]
    expect(e?.pesan).toBe('Transaction code 07 requires additional information (TD.005xx).')
  })

  it('skema yang tidak ada', () => {
    expect(kodeError(contoh(), { schema: '1999.01' })).toEqual(['SCHEMA_UNKNOWN'])
  })
})

describe('utilitas', () => {
  it('samarkan', () => {
    expect(samarkan('3201011201990001')).toBe('3201********0001')
  })
  it('referensi satuan berisi UM.0001 sampai UM.0039', () => {
    const s = referensi.satuan()
    expect(s).toHaveLength(39)
    expect(s.at(-1)).toEqual({ kode: 'UM.0039', nama: 'Roll' })
  })
})

describe('escape', () => {
  it('membuang karakter kontrol yang tidak sah di XML', () => {
    const b = contoh()
    ;(b.faktur[0] as FakturKeluaran).pembeli.alamat = 'Jl. A\u0000\u0007 No. 1'
    expect(fakturKeluaran.build(b)).toContain('<BuyerAdress>Jl. A No. 1</BuyerAdress>')
  })
})
