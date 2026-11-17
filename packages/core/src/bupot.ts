/**
 * Bukti potong PPh Pasal 21 (root `Bp21Bulk`) dan Pasal 26 (root `BP26Bulk`).
 *
 * Satu bukti potong = satu baris; tidak ada item. Deemed dan tarif boleh dikosongkan: diisi dari sheet REF dan rumus
 * template DJP. Library tidak menghitung jumlah PPh (tidak ada di XML; Coretax yang menghitung).
 */
import {
  bacaAngka,
  CoretaxValidationError,
  type Lokasi,
  Pengumpul,
  periksaDigit,
  tanggalValid,
  wajibTeks,
} from './faktur-keluaran.js'
import { formatXml, keSen, type Sen } from './money.js'
import * as bp21 from './schemas/bupot/bp21-v2025-04.js'
import * as bp26 from './schemas/bupot/bp26-v2024-12.js'
import { jenisDokumen, type TabelTarif } from './schemas/bupot/umum.js'
import { negara } from './schemas/faktur-keluaran/v2025-09.js'
import type { Angka, Bahasa, HasilValidasi, OpsiValidasi } from './types.js'
import { escapeXml } from './xml.js'
import { anak, type Node, nilai, parseXml, pengumpulXml, periksaElemen, XmlParseError } from './xml-baca.js'

export interface Pemotong {
  /** NPWP pemotong, 16 digit. Ditulis ke `TIN`; harus sama dengan NPWP yang login di Coretax. */
  npwp: string
  /** ID TKU pemotong, 22 digit. Ditulis ke `IDPlaceOfBusinessActivity` di setiap bukti potong. */
  nitku: string
}

interface BupotDasar {
  /** Masa pajak, 1 sampai 12. */
  masa: number | string
  tahun: number | string
  /** Kode fasilitas dari sheet REF. Default 'N/A' (tanpa fasilitas). */
  fasilitas?: string
  kodeObjekPajak: string
  /** Penghasilan bruto. */
  penghasilan: Angka
  /** Norma penghasilan bruto dalam persen (mis. 50). Jika kosong: dari daftar kode objek pajak. */
  deemed?: Angka
  /** Tarif dalam persen (mis. 5 atau 0.25). Jika kosong: dihitung seperti rumus template DJP. */
  tarif?: Angka
  /** Kode dari referensi.bupot.jenisDokumen(), mis. 'CommercialInvoice'. */
  jenisDokumen: string
  nomorDokumen: string
  /** YYYY-MM-DD; boleh kosong. */
  tanggalDokumen?: string
  /** YYYY-MM-DD, tidak boleh sebelum masa pajak. */
  tanggalPemotongan: string
  /** ID TKU pemotong untuk baris ini, jika berbeda dari pemotong.nitku. */
  nitkuPemotong?: string
}

export interface Bupot21 extends BupotDasar {
  penerima: {
    /** NIK atau NPWP penerima penghasilan, 16 digit. */
    npwp: string
    /** ID TKU penerima, 22 digit. Default: npwp + '000000'. */
    nitku?: string
    /** TK/0 sampai TK/3, K/0 sampai K/3. */
    statusPtkp: string
  }
}

export interface Bupot26 extends BupotDasar {
  penerima: {
    /** Nomor identitas pajak di negara asal (bebas, mis. 'NPWP-USA-ABC'). */
    tin: string
    nama: string
    /** Kode negara 3 huruf, mis. 'USA'. */
    negara: string
    alamat?: string
    /** YYYY-MM-DD */
    tanggalLahir?: string
    tempatLahir?: string
    paspor?: string
    kitas?: string
  }
  /** Nomor SKD WPLN; wajib jika fasilitas 'COD'. Default '-'. */
  nomorFasilitas?: string
}

export interface BatchBupot21 {
  pemotong: Pemotong
  bupot: Bupot21[]
}

export interface BatchBupot26 {
  pemotong: Pemotong
  bupot: Bupot26[]
}

type Jenis = '21' | '26'

/** Nilai tiap elemen XML (teks siap tulis; '' = kosong/nil), per bukti potong. */
export type BarisBupot = Record<string, string>

export interface AnalisisBupot {
  hasil: HasilValidasi
  tin: string
  bupot: BarisBupot[]
}

const SKEMA = { '21': bp21, '26': bp26 } as const
const AKAR = {
  '21': { akar: 'Bp21Bulk', daftar: 'ListOfBp21', baris: 'Bp21' },
  '26': { akar: 'BP26Bulk', daftar: 'ListOfBP26', baris: 'BP26' },
} as const

const LABEL: Partial<Record<Bahasa, Record<string, string>>> = {
  id: {
    'pemotong.npwp': 'NPWP pemotong',
    'pemotong.nitku': 'ID TKU pemotong',
    nitkuPemotong: 'ID TKU pemotong',
    'penerima.npwp': 'NPWP/NIK penerima',
    'penerima.nitku': 'ID TKU penerima',
    'penerima.tin': 'TIN penerima',
    'penerima.nama': 'Nama penerima',
    'penerima.tanggalLahir': 'Tanggal lahir penerima',
    masa: 'Masa pajak',
    tahun: 'Tahun pajak',
    kodeObjekPajak: 'Kode objek pajak',
    penghasilan: 'Penghasilan bruto',
    deemed: 'Deemed',
    tarif: 'Tarif',
    nomorDokumen: 'Nomor dokumen referensi',
    tanggalDokumen: 'Tanggal dokumen referensi',
    tanggalPemotongan: 'Tanggal pemotongan',
    'penerima.statusPtkp': 'Status PTKP',
    'penerima.negara': 'Kode negara penerima',
    fasilitas: 'Fasilitas',
    jenisDokumen: 'Jenis dokumen referensi',
    nomorFasilitas: 'Nomor fasilitas (SKD)',
  },
  en: {
    'pemotong.npwp': 'Withholder NPWP',
    'pemotong.nitku': 'Withholder ID TKU',
    nitkuPemotong: 'Withholder ID TKU',
    'penerima.npwp': 'Recipient NPWP/NIK',
    'penerima.nitku': 'Recipient ID TKU',
    'penerima.tin': 'Recipient TIN',
    'penerima.nama': 'Recipient name',
    'penerima.tanggalLahir': 'Recipient date of birth',
    masa: 'Tax period month',
    tahun: 'Tax period year',
    kodeObjekPajak: 'Tax object code',
    penghasilan: 'Gross income',
    deemed: 'Deemed',
    tarif: 'Rate',
    nomorDokumen: 'Reference document number',
    tanggalDokumen: 'Reference document date',
    tanggalPemotongan: 'Withholding date',
    'penerima.statusPtkp': 'PTKP status',
    'penerima.negara': 'Recipient country code',
    fasilitas: 'Facility',
    jenisDokumen: 'Reference document type',
    nomorFasilitas: 'Facility number (SKD)',
  },
}

const teks = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())
const persenKeSen = (p: number) => keSen(String(p))

/** Tarif (persen, dalam sen) dari tabel untuk DPP = penghasilan x deemed / 100, tanpa pembulatan. */
function dariTabel(tabel: TabelTarif, penghasilan: Sen, deemed: Sen): Sen {
  // dpp (sen) = penghasilan x deemed / 10000; dpp <= batas (rupiah) <=> penghasilan x deemed <= batas x 10^6
  const kali = penghasilan * deemed
  for (const [batas, tarif] of tabel) {
    if (batas === null || kali <= BigInt(batas) * 1_000_000n) return persenKeSen(tarif)
  }
  return 0n // tidak tercapai: baris terakhir selalu tanpa batas
}

/** Tarif PPh 21 seperti kolom Tarif template BP21 v.4. null jika kategori tidak bisa ditentukan. */
export function tarifBp21(kode: string, statusPtkp: string, penghasilan: Sen, deemed: Sen): Sen | null {
  const cara = bp21.kodeObjekPajak[kode]?.tarif
  if (cara === undefined) return null
  if (typeof cara === 'number') return persenKeSen(cara)
  if (cara === 'TER') {
    const kat = bp21.kategoriTer[statusPtkp]
    if (!kat) return null
    return dariTabel({ A: bp21.terA, B: bp21.terB, C: bp21.terC }[kat], penghasilan, deemed)
  }
  const tabel = { PS17: bp21.pasal17, HARIAN: bp21.harian, PESANGON: bp21.pesangon, PENSIUN: bp21.pensiun }[
    cara
  ]
  return dariTabel(tabel, penghasilan, deemed)
}

function analisisBupot(
  k: Pengumpul,
  jenis: Jenis,
  b: Bupot21 | Bupot26,
  n: number,
  nitkuPemotong: string,
  strict: boolean,
): BarisBupot {
  const s = SKEMA[jenis]
  const loc = (field: string, element: string | null): Lokasi => ({ faktur: n, item: null, field, element })
  const x = b ?? ({} as Bupot21)
  const baris: BarisBupot = {}

  // Masa dan tahun pajak
  const masa = teks(x.masa)
  const tahun = teks(x.tahun)
  if (!masa) k.tambah('error', 'REQUIRED', loc('masa', 'TaxPeriodMonth'))
  else if (!/^\d{1,2}$/.test(masa) || +masa < 1 || +masa > 12)
    k.tambah('error', 'PERIOD_FORMAT', loc('masa', 'TaxPeriodMonth'), { nilai: masa })
  if (!tahun) k.tambah('error', 'REQUIRED', loc('tahun', 'TaxPeriodYear'))
  else if (!/^\d{4}$/.test(tahun))
    k.tambah('error', 'PERIOD_FORMAT', loc('tahun', 'TaxPeriodYear'), { nilai: tahun })
  baris.TaxPeriodMonth = /^\d+$/.test(masa) ? String(+masa) : masa
  baris.TaxPeriodYear = tahun

  // Penerima
  if (jenis === '21') {
    const p = (x as Bupot21).penerima ?? ({} as Bupot21['penerima'])
    const npwp = periksaDigit(k, p.npwp, 16, loc('penerima.npwp', 'CounterpartTin'))
    const nitku = teks(p.nitku) || (npwp ? `${npwp}000000` : '')
    if (teks(p.nitku))
      periksaDigit(k, nitku, 22, loc('penerima.nitku', 'IDPlaceOfBusinessActivityOfIncomeRecipient'))
    const ptkp = teks(p.statusPtkp)
    if (!ptkp) k.tambah('error', 'REQUIRED', loc('penerima.statusPtkp', 'StatusTaxExemption'))
    else if (!bp21.statusPtkp.includes(ptkp))
      k.tambah('error', 'PTKP_UNKNOWN', loc('penerima.statusPtkp', 'StatusTaxExemption'), { nilai: ptkp })
    Object.assign(baris, {
      CounterpartTin: npwp,
      IDPlaceOfBusinessActivityOfIncomeRecipient: nitku,
      StatusTaxExemption: ptkp,
    })
  } else {
    const b26 = x as Bupot26
    const p = b26.penerima ?? ({} as Bupot26['penerima'])
    const kodeNegara = teks(p.negara).toUpperCase()
    if (!kodeNegara) k.tambah('error', 'REQUIRED', loc('penerima.negara', 'CounterpartCountry'))
    else if (!(kodeNegara in negara))
      k.tambah('error', 'COUNTRY_UNKNOWN', loc('penerima.negara', 'CounterpartCountry'), {
        nilai: kodeNegara,
      })
    const lahir = teks(p.tanggalLahir)
    if (lahir && !tanggalValid(lahir))
      k.tambah('error', 'DATE_FORMAT', loc('penerima.tanggalLahir', 'CounterpartDob'), { nilai: lahir })
    Object.assign(baris, {
      CounterpartTin: wajibTeks(k, p.tin, loc('penerima.tin', 'CounterpartTin')),
      CounterpartReceiptNumber: teks(b26.nomorFasilitas) || '-',
      CounterpartName: wajibTeks(k, p.nama, loc('penerima.nama', 'CounterpartName')),
      CounterpartCountry: kodeNegara,
      CounterpartAddress: teks(p.alamat),
      CounterpartDob: lahir,
      CounterpartBirthCity: teks(p.tempatLahir),
      CounterpartPassport: teks(p.paspor),
      CounterpartKitas: teks(p.kitas),
    })
  }

  // Fasilitas
  const fas = teks(x.fasilitas) || 'N/A'
  if (!(fas in s.fasilitas))
    k.tambah('error', 'TAX_CERT_UNKNOWN', loc('fasilitas', 'TaxCertificate'), { nilai: fas })
  if (jenis === '26' && fas === 'COD' && baris.CounterpartReceiptNumber === '-') {
    k.tambah('error', 'SKD_NUMBER_REQUIRED', loc('nomorFasilitas', 'CounterpartReceiptNumber'))
  }
  baris.TaxCertificate = fas

  // Kode objek pajak, penghasilan, deemed, tarif
  const kode = teks(x.kodeObjekPajak)
  const info = s.kodeObjekPajak[kode]
  if (!kode) k.tambah('error', 'REQUIRED', loc('kodeObjekPajak', 'TaxObjectCode'))
  else if (!info)
    k.tambah('warning', 'TAX_OBJECT_UNKNOWN', loc('kodeObjekPajak', 'TaxObjectCode'), {
      nilai: kode,
      pasal: jenis,
    })
  baris.TaxObjectCode = kode

  const penghasilan = bacaAngka(k, x.penghasilan, loc('penghasilan', 'Gross'), { wajib: true })
  if (penghasilan === 0n) k.tambah('error', 'AMOUNT_ZERO', loc('penghasilan', 'Gross'))
  baris.Gross = penghasilan === null ? '' : formatXml(penghasilan)

  // Selisih dengan referensi hanya wajar jika memakai fasilitas (SKB, SKD, lainnya); DTP tetap pakai tarif normal
  const bolehBeda = fas !== 'N/A' && fas !== 'DTP'
  const kosong = (v: unknown) => v === undefined || v === null || v === ''
  const isiAngka = (
    nama: 'deemed' | 'tarif',
    element: string,
    acuan: Sen | null,
    beda: (p: Record<string, string>) => void,
  ): Sen | null => {
    if (kosong(x[nama])) {
      if (strict) k.tambah('error', 'STRICT_VALUE_MISSING', loc(nama, element))
      else if (acuan === null) k.tambah('error', 'REQUIRED', loc(nama, element))
      return strict ? null : acuan
    }
    const v = bacaAngka(k, x[nama], loc(nama, element))
    if (v !== null && acuan !== null && v !== acuan && !bolehBeda) {
      beda({ nilai: formatXml(v), acuan: formatXml(acuan), kode })
    }
    return v
  }
  const deemed = isiAngka('deemed', 'Deemed', info ? persenKeSen(info.deemed) : null, (p) =>
    k.tambah('warning', 'DEEMED_MISMATCH', loc('deemed', 'Deemed'), p),
  )
  if (deemed !== null && deemed > 10000n)
    k.tambah('error', 'DEEMED_RANGE', loc('deemed', 'Deemed'), { nilai: formatXml(deemed) })
  const acuanTarif =
    penghasilan === null || deemed === null || !info
      ? null
      : jenis === '21'
        ? tarifBp21(kode, baris.StatusTaxExemption ?? '', penghasilan, deemed)
        : persenKeSen(info.tarif as number)
  const tarif = isiAngka('tarif', 'Rate', acuanTarif, (p) =>
    k.tambah('warning', 'RATE_MISMATCH', loc('tarif', 'Rate'), p),
  )
  baris.Deemed = deemed === null ? '' : formatXml(deemed)
  baris.Rate = tarif === null ? '' : formatXml(tarif)

  // Dokumen referensi
  const dok = teks(x.jenisDokumen)
  if (!dok) k.tambah('error', 'REQUIRED', loc('jenisDokumen', 'Document'))
  else if (!(dok in jenisDokumen))
    k.tambah('error', 'DOC_TYPE_UNKNOWN', loc('jenisDokumen', 'Document'), { nilai: dok })
  baris.Document = dok
  baris.DocumentNumber = wajibTeks(k, x.nomorDokumen, loc('nomorDokumen', 'DocumentNumber'))
  const tglDok = teks(x.tanggalDokumen)
  if (tglDok && !tanggalValid(tglDok))
    k.tambah('error', 'DATE_FORMAT', loc('tanggalDokumen', 'DocumentDate'), { nilai: tglDok })
  baris.DocumentDate = tglDok

  // Pemotong dan tanggal pemotongan
  const nitkuBaris = teks(x.nitkuPemotong)
  baris.IDPlaceOfBusinessActivity = nitkuBaris
    ? periksaDigit(k, nitkuBaris, 22, loc('nitkuPemotong', 'IDPlaceOfBusinessActivity'))
    : nitkuPemotong
  const tgl = teks(x.tanggalPemotongan)
  if (!tgl) k.tambah('error', 'REQUIRED', loc('tanggalPemotongan', 'WithholdingDate'))
  else if (!tanggalValid(tgl))
    k.tambah('error', 'DATE_FORMAT', loc('tanggalPemotongan', 'WithholdingDate'), { nilai: tgl })
  else if (/^\d{4}$/.test(tahun) && +masa >= 1 && +masa <= 12) {
    const awal = `${tahun}-${masa.padStart(2, '0')}-01`
    if (tgl < awal)
      k.tambah('error', 'WITHHOLDING_BEFORE_PERIOD', loc('tanggalPemotongan', 'WithholdingDate'), {
        nilai: tgl,
        masa: `${masa.padStart(2, '0')}/${tahun}`,
      })
  }
  baris.WithholdingDate = tgl
  return baris
}

function analisisJenis(jenis: Jenis, batch: BatchBupot21 | BatchBupot26, opsi: OpsiValidasi): AnalisisBupot {
  const s = SKEMA[jenis]
  const bahasa = opsi.bahasa ?? 'id'
  const k = new Pengumpul(bahasa, opsi.samarkan ?? true, undefined, LABEL)
  const idSkema = `${s.meta.dokumen}@${s.meta.id}`
  if (opsi.schema !== undefined && opsi.schema !== 'auto' && opsi.schema !== s.meta.id) {
    k.tambah(
      'error',
      'SCHEMA_UNKNOWN',
      { faktur: null, item: null, field: 'opsi.schema', element: null },
      {
        nilai: String(opsi.schema),
      },
    )
    return {
      hasil: { valid: false, schema: idSkema, errors: k.errors, warnings: k.warnings },
      tin: '',
      bupot: [],
    }
  }
  const lok = (field: string, element: string): Lokasi => ({ faktur: null, item: null, field, element })
  const tin = periksaDigit(k, batch?.pemotong?.npwp, 16, lok('pemotong.npwp', 'TIN'))
  const daftar: (Bupot21 | Bupot26)[] = Array.isArray(batch?.bupot) ? batch.bupot : []
  const perluNitku = daftar.some((b) => !teks(b?.nitkuPemotong))
  const nitku = perluNitku
    ? periksaDigit(k, batch?.pemotong?.nitku, 22, lok('pemotong.nitku', 'IDPlaceOfBusinessActivity'))
    : teks(batch?.pemotong?.nitku)
  if (daftar.length === 0) k.tambah('error', 'BUPOT_EMPTY', lok('bupot', AKAR[jenis].daftar))
  const strict = opsi.hitung === 'strict'
  const bupot = daftar.map((b, i) => analisisBupot(k, jenis, b, i + 1, nitku, strict))
  return {
    hasil: { valid: k.errors.length === 0, schema: idSkema, errors: k.errors, warnings: k.warnings },
    tin,
    bupot,
  }
}

export function tulisXmlBupot(jenis: Jenis, tin: string, bupot: BarisBupot[]): string {
  const { akar, daftar, baris } = AKAR[jenis]
  const s = SKEMA[jenis]
  const nil: readonly string[] = s.elemenNil
  const out = [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    `<${akar} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">`,
    `\t<TIN>${escapeXml(tin)}</TIN>`,
    `\t<${daftar}>`,
  ]
  for (const b of bupot) {
    out.push(`\t\t<${baris}>`)
    for (const el of s.elemenBupot) {
      const v = b[el] ?? ''
      out.push(
        v === ''
          ? nil.includes(el)
            ? `\t\t\t<${el} xsi:nil="true"/>`
            : `\t\t\t<${el}/>`
          : `\t\t\t<${el}>${escapeXml(v)}</${el}>`,
      )
    }
    out.push(`\t\t</${baris}>`)
  }
  out.push(`\t</${daftar}>`, `</${akar}>`, '')
  return out.join('\n')
}

function cekXml(jenis: Jenis, xml: string, opsi: OpsiValidasi): HasilValidasi {
  const s = SKEMA[jenis]
  const { akar: namaAkar, daftar: namaDaftar, baris: namaBaris } = AKAR[jenis]
  const bahasa: Bahasa = opsi.bahasa ?? 'id'
  const { errors, tambah } = pengumpulXml(bahasa)
  const gagal = (): HasilValidasi => ({
    valid: false,
    schema: `${s.meta.dokumen}@${s.meta.id}`,
    errors,
    warnings: [],
  })
  let akar: Node
  try {
    akar = parseXml(xml)
  } catch (e) {
    if (!(e instanceof XmlParseError)) throw e
    tambah('XML_PARSE', null, null, null, { posisi: e.posisi, detail: e.message })
    return gagal()
  }
  if (akar.nama !== namaAkar) {
    tambah('XML_ROOT', akar.nama, null, null, { nama: akar.nama, harap: namaAkar })
    return gagal()
  }
  periksaElemen(tambah, akar, ['TIN', namaDaftar], `<${namaAkar}>`, null, null)
  const awalan = bahasa === 'id' ? 'Bukti potong ke-' : 'Slip #'
  const rows = anak(akar, namaDaftar)?.anak.filter((a) => a.nama === namaBaris) ?? []
  const bupot = rows.map((r, i) => {
    periksaElemen(tambah, r, s.elemenBupot, `${awalan}${i + 1}`, i + 1, null)
    const v = (el: string) => nilai(r, el)
    const dasar = {
      masa: v('TaxPeriodMonth'),
      tahun: v('TaxPeriodYear'),
      fasilitas: v('TaxCertificate'),
      kodeObjekPajak: v('TaxObjectCode'),
      penghasilan: v('Gross'),
      deemed: v('Deemed'),
      tarif: v('Rate'),
      jenisDokumen: v('Document'),
      nomorDokumen: v('DocumentNumber'),
      tanggalDokumen: v('DocumentDate'),
      tanggalPemotongan: v('WithholdingDate'),
      nitkuPemotong: v('IDPlaceOfBusinessActivity'),
    }
    if (jenis === '21') {
      return {
        ...dasar,
        penerima: {
          npwp: v('CounterpartTin'),
          nitku: v('IDPlaceOfBusinessActivityOfIncomeRecipient'),
          statusPtkp: v('StatusTaxExemption'),
        },
      } satisfies Bupot21
    }
    return {
      ...dasar,
      nomorFasilitas: v('CounterpartReceiptNumber'),
      penerima: {
        tin: v('CounterpartTin'),
        nama: v('CounterpartName'),
        negara: v('CounterpartCountry'),
        alamat: v('CounterpartAddress'),
        tanggalLahir: v('CounterpartDob'),
        tempatLahir: v('CounterpartBirthCity'),
        paspor: v('CounterpartPassport'),
        kitas: v('CounterpartKitas'),
      },
    } satisfies Bupot26
  })
  const batch = { pemotong: { npwp: nilai(akar, 'TIN'), nitku: '' }, bupot } as BatchBupot21 | BatchBupot26
  const isi = analisisJenis(jenis, batch, { ...opsi, hitung: 'strict' }).hasil
  const semua = [...errors, ...isi.errors]
  return { valid: semua.length === 0, schema: isi.schema, errors: semua, warnings: isi.warnings }
}

function api<B extends BatchBupot21 | BatchBupot26>(jenis: Jenis) {
  const s = SKEMA[jenis]
  return {
    /** Validasi + nilai elemen per bukti potong (deemed dan tarif yang dipakai). */
    analisis: (batch: B, opsi: OpsiValidasi = {}) => analisisJenis(jenis, batch, opsi),
    /** Validasi tanpa membuat XML. */
    validate: (batch: B, opsi: OpsiValidasi = {}) => analisisJenis(jenis, batch, opsi).hasil,
    /** Buat string XML; melempar CoretaxValidationError jika ada error. */
    build: (batch: B, opsi: OpsiValidasi = {}): string => {
      const a = analisisJenis(jenis, batch, opsi)
      if (!a.hasil.valid) throw new CoretaxValidationError(a.hasil)
      return tulisXmlBupot(jenis, a.tin, a.bupot)
    },
    /** Periksa XML yang sudah ada: struktur, lalu isi (mode strict). */
    check: (xml: string, opsi: OpsiValidasi = {}) => cekXml(jenis, xml, opsi),
    schemas: () => [s.meta],
  }
}

export const bupot21 = api<BatchBupot21>('21')
export const bupot26 = api<BatchBupot26>('26')
