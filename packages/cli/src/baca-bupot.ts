import type { BatchBupot21, BatchBupot26, Bupot21, Bupot26 } from '@coretax-xml/core'
import { bulat2, tanggalIso } from './angka.js'
import { FormatBerkasError, norm, type OpsiBaca, pad, type Sumber } from './baca-faktur.js'
import { parseCsv } from './csv.js'
import type { Lembar } from './xlsx.js'

export type JenisBupot = 'bupot21' | 'bupot26'
export type HasilBupot =
  | { dokumen: 'bupot21'; batch: BatchBupot21; sumber: Sumber }
  | { dokumen: 'bupot26'; batch: BatchBupot26; sumber: Sumber }

/** Satu baris mentah (nama kolom netral -> teks sel), dari Excel atau CSV. */
type Ambil = (kunci: string) => string | undefined

function buatBaris(jenis: JenisBupot, g: Ambil, strict: boolean): Bupot21 | Bupot26 {
  const angka = (k: string) => {
    const v = bulat2(g(k))
    return v === '' ? undefined : v
  }
  const dasar = {
    masa: g('masa') ?? '',
    tahun: g('tahun') ?? '',
    fasilitas: g('fasilitas'),
    kodeObjekPajak: g('kop') ?? '',
    penghasilan: angka('penghasilan') ?? '',
    // Excel: --hitung strict memakai angka di sel; otomatis membiarkan library menghitung
    deemed: strict ? angka('deemed') : undefined,
    tarif: strict ? angka('tarif') : undefined,
    jenisDokumen: g('dok') ?? '',
    nomorDokumen: g('nomorDok') ?? '',
    tanggalDokumen: g('tanggalDok') ? tanggalIso(g('tanggalDok')) : undefined,
    tanggalPemotongan: tanggalIso(g('tanggalPotong')),
    nitkuPemotong: pad(g('nitkuPemotong'), 22),
  }
  if (jenis === 'bupot21') {
    return {
      ...dasar,
      penerima: { npwp: pad(g('npwp'), 16) ?? '', nitku: pad(g('nitku'), 22), statusPtkp: g('ptkp') ?? '' },
    }
  }
  return {
    ...dasar,
    nomorFasilitas: g('nomorFasilitas'),
    penerima: {
      tin: g('tin') ?? '',
      nama: g('nama') ?? '',
      negara: g('negara') ?? '',
      alamat: g('alamat'),
      tanggalLahir: g('lahir') ? tanggalIso(g('lahir')) : undefined,
      tempatLahir: g('tempatLahir'),
      paspor: g('paspor'),
      kitas: g('kitas'),
    },
  }
}

// ---------- Template Excel DJP (BP21 Excel to XML v.4 / BP26 Excel to XML): sheet DATA ----------

const JUDUL_EXCEL: Record<string, string> = {
  masa: 'Masa Pajak',
  tahun: 'Tahun Pajak',
  npwp: 'NPWP',
  nitku: 'ID TKU Penerima Penghasilan',
  ptkp: 'Status PTKP',
  tin: 'NPWP/TIN',
  nama: 'Nama Penerima Penghasilan',
  negara: 'Kode Negara',
  alamat: 'Alamat Penerima Penghasilan',
  lahir: 'Tanggal Lahir',
  tempatLahir: 'Tempat Lahir',
  paspor: 'No. Paspor',
  kitas: 'No. Kitas',
  fasilitas: 'Fasilitas',
  nomorFasilitas: 'Nomor Fasilitas',
  kop: 'Kode Objek Pajak',
  penghasilan: 'Penghasilan',
  deemed: 'Deemed',
  tarif: 'Tarif',
  dok: 'Jenis Dok. Referensi',
  nomorDok: 'Nomor Dok. Referensi',
  tanggalDok: 'Tanggal Dok. Referensi',
  nitkuPemotong: 'ID TKU Pemotong',
  tanggalPotong: 'Tanggal Pemotongan',
}

/** Jenis template dari nama sheet petunjuk (BP21 atau BP26) di sebelah sheet DATA. */
export function jenisExcelBupot(sheets: Record<string, Lembar>): JenisBupot | null {
  if (!sheets.DATA) return null
  if (sheets.BP21) return 'bupot21'
  if (sheets.BP26) return 'bupot26'
  return null
}

export function dariExcelBupot(
  sheets: Record<string, Lembar>,
  jenis: JenisBupot,
  opsi: OpsiBaca,
): HasilBupot {
  const lembar = sheets.DATA as Lembar
  const h = lembar.slice(0, 15).findIndex((b) => b?.some((x) => norm(x) === 'masa pajak'))
  if (h < 0) throw new FormatBerkasError('Sheet "DATA": baris judul (berisi "Masa Pajak") tidak ditemukan.')
  const kolom = new Map<string, number>()
  ;(lembar[h] ?? []).forEach((v, i) => {
    if (v !== undefined && !kolom.has(norm(v))) kolom.set(norm(v), i)
  })
  const npwpPemotong = pad(lembar[0]?.find((x, i) => i > 0 && x?.trim())?.trim(), 16) ?? ''
  const strict = opsi.hitung === 'strict'
  const bupot: (Bupot21 | Bupot26)[] = []
  const sumber: Sumber = { jenis: 'Excel', faktur: [], item: [] }
  for (let i = h + 1; i < lembar.length; i++) {
    const b = lembar[i]
    const g: Ambil = (k) => b?.[kolom.get(norm(JUDUL_EXCEL[k])) ?? -1]?.trim() || undefined
    if (!g('masa') && !g('kop') && !g('penghasilan')) continue // baris kosong (kolom rumus saja)
    bupot.push(buatBaris(jenis, g, strict))
    sumber.faktur.push(i + 1)
    sumber.item.push([])
  }
  const pemotong = { npwp: npwpPemotong, nitku: bupot[0]?.nitkuPemotong ?? '' }
  return jenis === 'bupot21'
    ? { dokumen: jenis, batch: { pemotong, bupot: bupot as Bupot21[] }, sumber }
    : { dokumen: jenis, batch: { pemotong, bupot: bupot as Bupot26[] }, sumber }
}

// ---------- CSV sederhana: satu baris = satu bukti potong ----------

const UMUM_AWAL = ['npwp_pemotong', 'nitku_pemotong', 'masa', 'tahun'] as const
const UMUM_AKHIR = [
  'fasilitas',
  'kode_objek_pajak',
  'penghasilan',
  'deemed',
  'tarif',
  'jenis_dokumen',
  'nomor_dokumen',
  'tanggal_dokumen',
  'tanggal_pemotongan',
] as const
export const KOLOM_CSV_BUPOT = {
  bupot21: [...UMUM_AWAL, 'npwp_penerima', 'nitku_penerima', 'status_ptkp', ...UMUM_AKHIR],
  bupot26: [
    ...UMUM_AWAL,
    'tin_penerima',
    'nama_penerima',
    'negara',
    'alamat',
    'tanggal_lahir',
    'tempat_lahir',
    'paspor',
    'kitas',
    'nomor_fasilitas',
    ...UMUM_AKHIR,
  ],
} as const

const CSV_KE_KUNCI: Record<string, string> = {
  masa: 'masa',
  tahun: 'tahun',
  npwp_penerima: 'npwp',
  nitku_penerima: 'nitku',
  status_ptkp: 'ptkp',
  tin_penerima: 'tin',
  nama_penerima: 'nama',
  negara: 'negara',
  alamat: 'alamat',
  tanggal_lahir: 'lahir',
  tempat_lahir: 'tempatLahir',
  paspor: 'paspor',
  kitas: 'kitas',
  nomor_fasilitas: 'nomorFasilitas',
  fasilitas: 'fasilitas',
  kode_objek_pajak: 'kop',
  penghasilan: 'penghasilan',
  deemed: 'deemed',
  tarif: 'tarif',
  jenis_dokumen: 'dok',
  nomor_dokumen: 'nomorDok',
  tanggal_dokumen: 'tanggalDok',
  nitku_pemotong: 'nitkuPemotong',
  tanggal_pemotongan: 'tanggalPotong',
}

const WAJIB_CSV: Record<JenisBupot, string[]> = {
  bupot21: [
    'npwp_pemotong',
    'masa',
    'tahun',
    'npwp_penerima',
    'status_ptkp',
    'kode_objek_pajak',
    'penghasilan',
  ],
  bupot26: [
    'npwp_pemotong',
    'masa',
    'tahun',
    'tin_penerima',
    'nama_penerima',
    'negara',
    'kode_objek_pajak',
    'penghasilan',
  ],
}

/** Jenis CSV dari baris judul: status_ptkp = bupot21, nama_penerima = bupot26. */
export function jenisCsvBupot(teks: string): JenisBupot | null {
  const judul = (teks.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '').split(/[,;]/).map((k) => norm(k))
  if (judul.includes('status_ptkp')) return 'bupot21'
  if (judul.includes('nama_penerima')) return 'bupot26'
  return null
}

const CONTOH: Record<JenisBupot, Record<string, string>> = {
  bupot21: {
    npwp_pemotong: '0000000000000000',
    nitku_pemotong: '0000000000000000000000',
    masa: '1',
    tahun: '2025',
    npwp_penerima: '0000000000000000',
    status_ptkp: 'TK/0',
    fasilitas: 'N/A',
    kode_objek_pajak: '21-100-35',
    penghasilan: '10000000',
    jenis_dokumen: 'PaymentProof',
    nomor_dokumen: 'GAJI-2025-01',
    tanggal_dokumen: '2025-01-25',
    tanggal_pemotongan: '2025-01-25',
  },
  bupot26: {
    npwp_pemotong: '0000000000000000',
    nitku_pemotong: '0000000000000000000000',
    masa: '1',
    tahun: '2025',
    tin_penerima: 'TIN-USA-001',
    nama_penerima: 'JOHN DOE',
    negara: 'USA',
    fasilitas: 'N/A',
    nomor_fasilitas: '-',
    kode_objek_pajak: '27-100-99',
    penghasilan: '50000000',
    jenis_dokumen: 'CommercialInvoice',
    nomor_dokumen: 'INV-001',
    tanggal_dokumen: '2025-01-10',
    tanggal_pemotongan: '2025-01-20',
  },
}

/** Contoh CSV bukti potong dengan satu baris isi (NPWP nol). Deemed dan tarif dikosongkan: dihitung library. */
export function templateCsvBupot(jenis: JenisBupot): string {
  const kolom = KOLOM_CSV_BUPOT[jenis]
  return `${kolom.join(',')}\n${kolom.map((k) => CONTOH[jenis][k] ?? '').join(',')}\n`
}

export function dariCsvBupot(teks: string, jenis: JenisBupot): HasilBupot {
  const rows = parseCsv(teks)
  const judul = (rows[0] ?? []).map(norm)
  const hilang = WAJIB_CSV[jenis].filter((k) => !judul.includes(k))
  if (hilang.length > 0) {
    throw new FormatBerkasError(
      `Kolom wajib tidak ada di CSV ${jenis}: ${hilang.join(', ')}. Buat contoh dengan: coretax-xml template ${jenis}`,
    )
  }
  const bupot: (Bupot21 | Bupot26)[] = []
  const sumber: Sumber = { jenis: 'CSV', faktur: [], item: [] }
  let npwpPemotong: string | undefined
  const beda: number[] = []
  rows.forEach((b, i) => {
    if (i === 0 || b.every((x) => !x.trim())) return
    const kolom = (nama: string) => b[judul.indexOf(nama)]?.trim() || undefined
    const npwp = pad(kolom('npwp_pemotong'), 16) ?? ''
    if (npwpPemotong === undefined) npwpPemotong = npwp
    else if (npwp !== npwpPemotong) beda.push(i + 1)
    const balik = Object.fromEntries(Object.entries(CSV_KE_KUNCI).map(([csv, k]) => [k, csv]))
    // CSV: deemed/tarif yang diisi selalu dipakai; yang kosong dihitung (atau ditolak di mode strict oleh library)
    bupot.push(buatBaris(jenis, (k) => kolom(balik[k] ?? k), true))
    sumber.faktur.push(i + 1)
    sumber.item.push([])
  })
  if (beda.length > 0) {
    throw new FormatBerkasError(
      `npwp_pemotong harus sama di semua baris (satu pemotong per file). Berbeda di baris ${beda.join(', ')}.`,
    )
  }
  const pemotong = { npwp: npwpPemotong ?? '', nitku: bupot[0]?.nitkuPemotong ?? '' }
  return jenis === 'bupot21'
    ? { dokumen: jenis, batch: { pemotong, bupot: bupot as Bupot21[] }, sumber }
    : { dokumen: jenis, batch: { pemotong, bupot: bupot as Bupot26[] }, sumber }
}
