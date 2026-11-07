import type { BatchReturFakturMasukan, ItemRetur, ReturFakturMasukan } from 'coretax-xml'
import { bulat2, tanggalIso } from './angka.js'
import {
  barisData,
  FormatBerkasError,
  jenisItem,
  norm,
  type OpsiBaca,
  pad,
  type Sumber,
} from './baca-faktur.js'
import { parseCsv } from './csv.js'
import type { Lembar } from './xlsx.js'

const KOLOM_RETUR: Record<string, string> = {
  nomor: 'Nomor Faktur',
  penjual: 'NPWP Penjual',
  tanggal: 'Tanggal Retur',
  dpp: 'DPP Retur',
  dppLain: 'DPP Lain Retur',
  ppn: 'PPN Retur',
  ppnbm: 'PPnBM Retur',
}
const KOLOM_DETAIL: Record<string, string> = {
  jenis: 'Jenis Barang Jasa',
  nama: 'Nama Barang Jasa',
  kode: 'Kode Barang Jasa',
  jumlah: 'Jumlah Barang Jasa',
  satuan: 'Satuan Ukur Barang Jasa',
  harga: 'Harga Satuan',
  jumlahRetur: 'Jumlah Barang Retur',
  diskon: 'Diskon Retur',
  dpp: 'DPP Retur',
  flag: 'Flag DPP Lain Retur',
  dppLain: 'DPP Lain Retur',
  ppn: 'PPN Retur',
  tarifBm: 'Tarif PPnBM',
  ppnbm: 'PPNBM Retur',
}

/** Template Excel retur faktur pajak masukan DJP (sheet Retur + DetailRetur). Kolom Total di sheet Retur tidak dibaca: DJP meminta isinya sama dengan kolom nilainya. */
export function dariExcelRetur(
  sheets: Record<string, Lembar>,
  opsi: OpsiBaca,
): { batch: BatchReturFakturMasukan; sumber: Sumber } {
  const rs = sheets.Retur
  const ds = sheets.DetailRetur
  if (!rs || !ds) {
    throw new FormatBerkasError(
      `Sheet "${rs ? 'DetailRetur' : 'Retur'}" tidak ditemukan. File ini bukan template Excel retur faktur pajak masukan DJP.`,
    )
  }
  const retur = barisData(rs, 'Retur')
  const detail = barisData(ds, 'DetailRetur')
  const strict = opsi.hitung === 'strict'

  const batch: BatchReturFakturMasukan = { pembeli: { npwp: pad(rs[0]?.[2]?.trim(), 16) ?? '' }, retur: [] }
  const sumber: Sumber = { jenis: 'Excel', faktur: [], item: [] }
  const indeks = new Map<string, number>()
  for (const [nomor, b] of retur.baris) {
    const g = (n: string) => retur.ambil(b, n, KOLOM_RETUR)
    const r: ReturFakturMasukan = {
      nomorFaktur: pad(g('nomor'), 17) as string,
      npwpPenjual: pad(g('penjual'), 16) as string,
      tanggal: tanggalIso(g('tanggal')),
      item: [],
    }
    if (strict) {
      r.dpp = bulat2(g('dpp'))
      r.dppLain = bulat2(g('dppLain'))
      r.ppn = bulat2(g('ppn'))
      r.ppnbm = bulat2(g('ppnbm'))
    }
    indeks.set(b[0]?.trim() ?? '', batch.retur.length)
    batch.retur.push(r)
    sumber.faktur.push(nomor)
    sumber.item.push([])
  }

  const yatim: number[] = []
  for (const [nomor, b] of detail.baris) {
    const ri = indeks.get(b[0]?.trim() ?? '')
    if (ri === undefined) {
      yatim.push(nomor)
      continue
    }
    const g = (n: string) => detail.ambil(b, n, KOLOM_DETAIL)
    const pakai = /^(yes|ya|true|1)$/i.test(g('flag') ?? '')
    const item: ItemRetur = {
      jenis: jenisItem(g('jenis')),
      nama: g('nama') as string,
      kode: pad(g('kode'), 6),
      jumlah: bulat2(g('jumlah')) as string,
      satuan: g('satuan') as string,
      harga: bulat2(g('harga')) as string,
      tarifPpnbm: bulat2(g('tarifBm')),
      jumlahRetur: bulat2(g('jumlahRetur')) as string,
      diskonRetur: bulat2(g('diskon')),
      pakaiDppLain: pakai,
      ppn: bulat2(g('ppn')) as string,
      ppnbm: bulat2(g('ppnbm')),
    }
    if (strict) item.dpp = bulat2(g('dpp'))
    if (strict || pakai) item.dppLain = bulat2(g('dppLain'))
    batch.retur[ri]?.item.push(item)
    sumber.item[ri]?.push(nomor)
  }
  if (yatim.length > 0) {
    throw new FormatBerkasError(
      `Sheet DetailRetur baris ${yatim.join(', ')}: nilai kolom Baris tidak ada di sheet Retur.`,
    )
  }
  return { batch, sumber }
}

// ---------- CSV sederhana untuk retur: satu baris = satu barang, data retur diulang di tiap baris ----------

export const KOLOM_CSV_RETUR = [
  'no_retur',
  'nomor_faktur',
  'npwp_penjual',
  'tanggal',
  'dpp_total',
  'dpp_lain_total',
  'ppn_total',
  'ppnbm_total',
  'jenis_item',
  'kode_barang',
  'nama_barang',
  'satuan',
  'jumlah_faktur',
  'harga',
  'tarif_ppnbm',
  'jumlah_retur',
  'diskon_retur',
  'dpp',
  'pakai_dpp_lain',
  'dpp_lain',
  'ppn',
  'ppnbm',
  'npwp_pembeli',
] as const

const WAJIB_CSV_RETUR = [
  'no_retur',
  'nomor_faktur',
  'npwp_penjual',
  'tanggal',
  'nama_barang',
  'jumlah_faktur',
  'harga',
  'jumlah_retur',
  'ppn',
  'npwp_pembeli',
]

/** true jika baris judul CSV milik retur (kolom no_retur). */
export const adalahCsvRetur = (teks: string) =>
  (teks.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '')
    .split(/[,;]/)
    .some((k) => k.trim().toLowerCase() === 'no_retur')

/** Contoh CSV retur dengan satu baris isi (nomor faktur dari sampel DJP; NPWP nol). */
export function templateCsvRetur(): string {
  const contoh: Record<string, string> = {
    no_retur: 'RETUR-001',
    nomor_faktur: '04002500000348920',
    npwp_penjual: '0000000000000000',
    tanggal: '2025-02-27',
    jenis_item: 'barang',
    kode_barang: '000000',
    nama_barang: 'Barang',
    satuan: 'UM.0033',
    jumlah_faktur: '1',
    harga: '10000',
    jumlah_retur: '1',
    ppn: '1100',
    npwp_pembeli: '0000000000000000',
  }
  return `${KOLOM_CSV_RETUR.join(',')}\n${KOLOM_CSV_RETUR.map((k) => contoh[k] ?? '').join(',')}\n`
}

export function dariCsvRetur(
  teks: string,
  opsi: OpsiBaca,
): { batch: BatchReturFakturMasukan; sumber: Sumber } {
  const rows = parseCsv(teks)
  const judul = (rows[0] ?? []).map(norm)
  const hilang = WAJIB_CSV_RETUR.filter((k) => !judul.includes(k))
  if (hilang.length > 0) {
    throw new FormatBerkasError(
      `Kolom wajib tidak ada di CSV retur: ${hilang.join(', ')}. Buat contoh dengan: coretax-xml template retur-masukan`,
    )
  }
  const ambil = (b: string[], nama: string) => b[judul.indexOf(nama)]?.trim()
  const strict = opsi.hitung === 'strict'

  const batch: BatchReturFakturMasukan = { pembeli: { npwp: '' }, retur: [] }
  const sumber: Sumber = { jenis: 'CSV', faktur: [], item: [] }
  const indeks = new Map<string, number>()
  const pembeliBeda: number[] = []
  let pertama = true
  rows.forEach((b, i) => {
    if (i === 0 || b.every((x) => !x.trim())) return
    const nomor = i + 1
    const npwp = pad(ambil(b, 'npwp_pembeli'), 16) ?? ''
    if (pertama) batch.pembeli.npwp = npwp
    else if (npwp !== batch.pembeli.npwp) pembeliBeda.push(nomor)
    pertama = false

    const kunci = ambil(b, 'no_retur') ?? ''
    let ri = indeks.get(kunci)
    if (ri === undefined) {
      ri = batch.retur.length
      indeks.set(kunci, ri)
      const r: ReturFakturMasukan = {
        nomorFaktur: pad(ambil(b, 'nomor_faktur'), 17) as string,
        npwpPenjual: pad(ambil(b, 'npwp_penjual'), 16) as string,
        tanggal: tanggalIso(ambil(b, 'tanggal')),
        item: [],
      }
      if (strict) {
        r.dpp = bulat2(ambil(b, 'dpp_total'))
        r.dppLain = bulat2(ambil(b, 'dpp_lain_total'))
        r.ppn = bulat2(ambil(b, 'ppn_total'))
        r.ppnbm = bulat2(ambil(b, 'ppnbm_total'))
      }
      batch.retur.push(r)
      sumber.faktur.push(nomor)
      sumber.item.push([])
    }
    const pakai = /^(yes|ya|true|1)$/i.test(ambil(b, 'pakai_dpp_lain') ?? '')
    const item: ItemRetur = {
      jenis: jenisItem(ambil(b, 'jenis_item')),
      nama: ambil(b, 'nama_barang') as string,
      kode: pad(ambil(b, 'kode_barang'), 6),
      jumlah: bulat2(ambil(b, 'jumlah_faktur')) as string,
      satuan: ambil(b, 'satuan') as string,
      harga: bulat2(ambil(b, 'harga')) as string,
      tarifPpnbm: bulat2(ambil(b, 'tarif_ppnbm')),
      jumlahRetur: bulat2(ambil(b, 'jumlah_retur')) as string,
      diskonRetur: bulat2(ambil(b, 'diskon_retur')),
      pakaiDppLain: pakai,
      ppn: bulat2(ambil(b, 'ppn')) as string,
      ppnbm: bulat2(ambil(b, 'ppnbm')),
    }
    if (strict) item.dpp = bulat2(ambil(b, 'dpp'))
    if (strict || pakai) item.dppLain = bulat2(ambil(b, 'dpp_lain'))
    batch.retur[ri]?.item.push(item)
    sumber.item[ri]?.push(nomor)
  })
  if (pembeliBeda.length > 0) {
    throw new FormatBerkasError(
      `npwp_pembeli harus sama di semua baris (satu pelapor per file). Berbeda di baris ${pembeliBeda.join(', ')}.`,
    )
  }
  return { batch, sumber }
}
