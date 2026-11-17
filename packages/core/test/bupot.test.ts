import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  type BatchBupot21,
  type BatchBupot26,
  bupot21,
  bupot26,
  CoretaxValidationError,
} from '../src/index.js'
import * as bp21 from '../src/schemas/bupot/bp21-v2025-04.js'

const dariRepo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url))
const baca = (p: string) => readFileSync(dariRepo(p), 'utf8')
const normal = (x: string) => x.replace(/\r\n/g, '\n').trim()
const kode = (h: { errors: { code: string }[] }) => h.errors.map((e) => e.code)

const NITKU_POTONG = '0029482015507000000000'
const dasar = {
  tanggalPemotongan: '2024-01-21',
  nitkuPemotong: undefined,
}

/** Padanan data untuk sampel resmi bp21.xml (4 bukti potong). */
function sampel21(): BatchBupot21 {
  const b = (
    npwp: string,
    ptkp: string,
    fasilitas: string,
    kop: string,
    penghasilan: number,
    deemed: number,
    tarif: number,
    jenisDokumen: string,
    nomorDokumen: string,
    tanggalDokumen: string,
  ) => ({
    ...dasar,
    masa: 1,
    tahun: 2024,
    penerima: { npwp, statusPtkp: ptkp },
    fasilitas,
    kodeObjekPajak: kop,
    penghasilan,
    deemed,
    tarif,
    jenisDokumen,
    nomorDokumen,
    tanggalDokumen,
  })
  return {
    pemotong: { npwp: '0029482015507000', nitku: NITKU_POTONG },
    bupot: [
      b(
        '1403011006750026',
        'K/3',
        'N/A',
        '21-100-35',
        40000000,
        100,
        16,
        'CommercialInvoice',
        'ABC123',
        '2024-01-13',
      ),
      b(
        '3173062510770011',
        'TK/0',
        'TaxExAr21',
        '21-100-34',
        100000000,
        50,
        0,
        'TaxInvoice',
        '0100012292489165',
        '2022-02-26',
      ),
      b(
        '3374142512700001',
        'K/1',
        'DTP',
        '21-402-03',
        5000000,
        100,
        15,
        'CommercialInvoice',
        'ABC123',
        '2024-01-13',
      ),
      b(
        '1406030510790003',
        'K/2',
        'ETC',
        '21-100-35',
        40000000,
        1,
        1,
        'CommercialInvoice',
        'ABC123',
        '2024-01-13',
      ),
    ],
  }
}

function sampel26(): BatchBupot26 {
  const b = (
    tin: string,
    nomorFasilitas: string,
    nama: string,
    negara: string,
    alamat: string,
    tanggalLahir: string,
    tempatLahir: string,
    fasilitas: string,
    penghasilan: number,
    deemed: number,
    tarif: number,
    jenisDokumen: string,
    nomorDokumen: string,
    tanggalDokumen: string,
  ) => ({
    masa: 10,
    tahun: 2024,
    penerima: { tin, nama, negara, alamat, tanggalLahir, tempatLahir },
    nomorFasilitas,
    fasilitas,
    kodeObjekPajak: '27-100-99',
    penghasilan,
    deemed,
    tarif,
    jenisDokumen,
    nomorDokumen,
    tanggalDokumen,
    tanggalPemotongan: '2024-10-21',
  })
  return {
    pemotong: { npwp: '0029482015507000', nitku: NITKU_POTONG },
    bupot: [
      b(
        'NPWP-USA-ABC',
        '-',
        'JASON LEE SCOOT',
        'USA',
        'CALIFORNIA',
        '1980-01-13',
        'LAS VEGAS',
        'N/A',
        100000000,
        100,
        20,
        'CommercialInvoice',
        'ABC123',
        '2024-01-13',
      ),
      b(
        'NPWP-JEPANG-123',
        '-',
        'IKARI SHINJI',
        'JPN',
        'SHIBUYA',
        '1976-02-14',
        'OTSUKA',
        'DTP',
        200000000,
        100,
        20,
        'TaxInvoice',
        '0100012292489165',
        '2022-02-26',
      ),
      b(
        '4567',
        'SKDWPLN-ESP/2/2024/00022',
        'DAVE NAVARO',
        'ESP',
        'JAGALONIA',
        '1990-03-15',
        'MADRID',
        'COD',
        40000000,
        2,
        0.5,
        'CommercialInvoice',
        'ABC123',
        '2024-01-13',
      ),
      b(
        'NPWP-SGP-XYZ',
        '-',
        'DATOK CHING',
        'SGP',
        'BUGIS STREET',
        '1985-04-16',
        'KAMPONG DURIAN RUNTUH',
        'ETC',
        50000000,
        1,
        1,
        'CommercialInvoice',
        'ABC123',
        '2024-01-13',
      ),
    ],
  }
}

describe('sampel resmi DJP', () => {
  it('bp21.xml: XML library sama persis (selain akhir baris CRLF)', () => {
    expect(normal(bupot21.build(sampel21()))).toBe(normal(baca('fixtures/djp/bp21.xml')))
  })

  it('bp26.xml: sama persis, termasuk xsi:nil untuk paspor dan KITAS kosong', () => {
    expect(normal(bupot26.build(sampel26()))).toBe(normal(baca('fixtures/djp/bp26.xml')))
  })

  it('check() menerima kedua sampel; tarif 16% di sampel BP21 hanya diberi peringatan (rumus v.4: TER C 15%)', () => {
    const h21 = bupot21.check(baca('fixtures/djp/bp21.xml'))
    expect(h21.errors).toEqual([])
    expect(h21.warnings.map((w) => [w.code, w.faktur, w.element])).toEqual([['RATE_MISMATCH', 1, 'Rate']])
    const h26 = bupot26.check(baca('fixtures/djp/bp26.xml'))
    expect(h26.errors).toEqual([])
    expect(h26.warnings).toEqual([])
  })

  it('check() menolak akar yang salah', () => {
    expect(kode(bupot26.check(baca('fixtures/djp/bp21.xml')))).toEqual(['XML_ROOT'])
  })
})

describe('tarif seperti rumus template BP21 v.4', () => {
  const satu = (ubah: Record<string, unknown>) => {
    const b = sampel21()
    const x = { ...b.bupot[0], fasilitas: 'N/A', deemed: undefined, tarif: undefined, ...ubah }
    const a = bupot21.analisis({ ...b, bupot: [x as BatchBupot21['bupot'][0]] })
    expect(a.hasil.errors).toEqual([])
    return [a.bupot[0]?.Deemed, a.bupot[0]?.Rate]
  }

  // Nilai tersimpan di sheet DATA template (baris 4 sampai 9, kolom J dan K)
  it.each([
    ['K/0', '21-100-35', 14058150, '100', '6'],
    ['TK/0', '21-100-07', 10000000, '50', '5'],
    ['K/1', '21-100-24', 2000000, '100', '0.5'],
    ['TK/0', '21-402-02', 600000, '100', '5'],
    ['TK/0', '21-401-01', 500000000, '100', '15'],
    ['K/1', '21-401-02', 100000000, '100', '5'],
  ])('%s %s %d -> deemed %s, tarif %s (contoh di template)', (ptkp, kop, penghasilan, deemed, tarif) => {
    expect(
      satu({ penerima: { npwp: '1403011006750026', statusPtkp: ptkp }, kodeObjekPajak: kop, penghasilan }),
    ).toEqual([deemed, tarif])
  })

  it('batas tabel inklusif, dihitung dari DPP (penghasilan x deemed)', () => {
    const p = (statusPtkp: string) => ({ penerima: { npwp: '1403011006750026', statusPtkp } })
    expect(satu({ ...p('TK/0'), penghasilan: 5400000 })[1]).toBe('0')
    expect(satu({ ...p('TK/0'), penghasilan: '5400000.01' })[1]).toBe('0.25')
    expect(satu({ ...p('K/3'), penghasilan: 1419000000 })[1]).toBe('33')
    expect(satu({ ...p('K/3'), penghasilan: 1419000001 })[1]).toBe('34')
    // PS17 dengan deemed 50: penghasilan 120 juta -> DPP 60 juta (lapisan 5%), 1 sen lebih -> 15%
    expect(satu({ ...p('TK/0'), kodeObjekPajak: '21-100-07', penghasilan: 120000000 })[1]).toBe('5')
    expect(satu({ ...p('TK/0'), kodeObjekPajak: '21-100-07', penghasilan: '120000000.02' })[1]).toBe('15')
  })

  it('tabel di skema sama dengan rumus di template (fixtures/bupot/rumus-bp21.json)', () => {
    const { kolom } = JSON.parse(baca('fixtures/bupot/rumus-bp21.json')) as { kolom: Record<string, string> }
    const urai = (f: string) => {
      const t = f.replace(/R4/g, 'R')
      const baris: [number | null, number][] = []
      const awal = /^IF\(R<=(\d+),([\d.]+),/.exec(t)
      if (awal) baris.push([Number(awal[1]), Number(awal[2])])
      for (const m of t.matchAll(/IF\(AND\(R>\d+,R<=(\d+)\),([\d.]+),/g))
        baris.push([Number(m[1]), Number(m[2])])
      baris.push([null, Number(/,([\d.]+)\)+$/.exec(t)?.[1])])
      return baris
    }
    const peta = {
      T: bp21.terA,
      U: bp21.terB,
      V: bp21.terC,
      W: bp21.pasal17,
      X: bp21.harian,
      Y: bp21.pesangon,
      Z: bp21.pensiun,
    }
    for (const [k, tabel] of Object.entries(peta))
      expect(tabel, `kolom ${k}`).toEqual(urai(kolom[k] as string))
  })
})

describe('validasi', () => {
  const ubah21 = (ubah: Record<string, unknown>) => {
    const b = sampel21()
    return { ...b, bupot: [{ ...b.bupot[3], ...ubah } as BatchBupot21['bupot'][0]] }
  }

  it('masa, PTKP, fasilitas, jenis dokumen, dan tanggal pemotongan', () => {
    expect(kode(bupot21.validate(ubah21({ masa: 13 })))).toEqual(['PERIOD_FORMAT'])
    expect(
      kode(bupot21.validate(ubah21({ penerima: { npwp: '1406030510790003', statusPtkp: 'HB/0' } }))),
    ).toEqual(['PTKP_UNKNOWN'])
    expect(kode(bupot21.validate(ubah21({ fasilitas: 'COD' })))).toEqual(['TAX_CERT_UNKNOWN'])
    expect(kode(bupot21.validate(ubah21({ jenisDokumen: 'Announchment' })))).toEqual(['DOC_TYPE_UNKNOWN'])
    expect(kode(bupot21.validate(ubah21({ tanggalPemotongan: '2023-12-31' })))).toEqual([
      'WITHHOLDING_BEFORE_PERIOD',
    ])
    expect(kode(bupot21.validate(ubah21({ penghasilan: 0 })))).toEqual(['AMOUNT_ZERO'])
    expect(kode(bupot21.validate(ubah21({ deemed: 101 })))).toEqual(['DEEMED_RANGE'])
  })

  it('ID TKU penerima default NPWP + 000000; ID TKU per baris boleh berbeda dari pemotong', () => {
    const a = bupot21.analisis(ubah21({ nitkuPemotong: '0029482015507000000001' }))
    expect(a.bupot[0]?.IDPlaceOfBusinessActivityOfIncomeRecipient).toBe('1406030510790003000000')
    expect(a.bupot[0]?.IDPlaceOfBusinessActivity).toBe('0029482015507000000001')
  })

  it('kode objek pajak di luar daftar: peringatan, dan deemed/tarif wajib diisi', () => {
    const h = bupot21.validate(ubah21({ kodeObjekPajak: '21-999-99', deemed: undefined, tarif: undefined }))
    expect(kode(h)).toEqual(['REQUIRED', 'REQUIRED'])
    expect(h.warnings.map((w) => w.code)).toEqual(['TAX_OBJECT_UNKNOWN'])
  })

  it('mode strict mewajibkan deemed dan tarif', () => {
    const h = bupot21.validate(ubah21({ deemed: undefined, tarif: undefined }), { hitung: 'strict' })
    expect(kode(h)).toEqual(['STRICT_VALUE_MISSING', 'STRICT_VALUE_MISSING'])
  })

  it('BP26: SKD (COD) wajib nomor fasilitas; negara harus dari daftar', () => {
    const b = sampel26()
    const x = b.bupot[2] as BatchBupot26['bupot'][0]
    expect(kode(bupot26.validate({ ...b, bupot: [{ ...x, nomorFasilitas: '' }] }))).toEqual([
      'SKD_NUMBER_REQUIRED',
    ])
    expect(
      kode(bupot26.validate({ ...b, bupot: [{ ...x, penerima: { ...x.penerima, negara: 'XYZ' } }] })),
    ).toEqual(['COUNTRY_UNKNOWN'])
  })

  it('build melempar CoretaxValidationError; batch kosong ditolak', () => {
    expect(() =>
      bupot21.build({ pemotong: { npwp: '0029482015507000', nitku: NITKU_POTONG }, bupot: [] }),
    ).toThrow(CoretaxValidationError)
  })

  it('karakter khusus di-escape; DocumentDate kosong ditulis xsi:nil', () => {
    const xml = bupot21.build(ubah21({ nomorDokumen: 'A&B <1>', tanggalDokumen: '' }))
    expect(xml).toContain('<DocumentNumber>A&amp;B &lt;1&gt;</DocumentNumber>')
    expect(xml).toContain('<DocumentDate xsi:nil="true"/>')
    expect(bupot21.check(xml).errors).toEqual([])
  })
})
