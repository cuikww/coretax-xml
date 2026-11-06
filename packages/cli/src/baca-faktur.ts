import type { BatchFakturKeluaran, FakturKeluaran, ItemFaktur, JenisId } from 'coretax-xml'
import { bulat2, tanggalIso } from './angka.js'
import { parseCsv } from './csv.js'
import type { Lembar } from './xlsx.js'

/** Nomor baris di file asal untuk setiap faktur dan item, urut sama dengan batch, supaya error bisa menunjuk baris Excel/CSV. */
export interface Sumber {
  jenis: 'Excel' | 'CSV'
  faktur: number[]
  item: number[][]
}

export interface HasilBaca {
  batch: BatchFakturKeluaran
  sumber: Sumber
}

export interface OpsiBaca {
  /** 'strict': angka DPP/DPP nilai lain/PPN/PPnBM dibaca dari file lalu dicocokkan dengan hitungan. 'otomatis': dihitung library. */
  hitung: 'strict' | 'otomatis'
}

/** File bukan format yang dikenal (sheet atau kolom wajib tidak ada). Bukan error isi data. */
export class FormatBerkasError extends Error {}

const norm = (s: string | undefined) => (s ?? '').trim().toLowerCase()
const pad = (s: string | undefined, n: number) =>
  s && /^\d+$/.test(s) && s.length < n ? s.padStart(n, '0') : s // Excel membuang nol di depan angka
const jenisItem = (j: string | undefined) =>
  (j === 'A' ? 'barang' : j === 'B' ? 'jasa' : j) as ItemFaktur['jenis']

function buatFaktur(
  g: (n: string) => string | undefined,
  pembeli: { npwp?: string; nitku?: string },
): FakturKeluaran {
  return {
    tanggal: tanggalIso(g('tanggal')),
    kodeTransaksi: pad(g('kode')?.trim(), 2) as FakturKeluaran['kodeTransaksi'],
    referensi: g('referensi'),
    keteranganTambahan: g('ket'),
    dokumenPendukung: g('dok'),
    periodeDokumenPendukung: g('periode'),
    capFasilitas: g('cap'),
    pembeli: {
      jenisId: g('jenisid') as JenisId,
      npwp: pembeli.npwp,
      nitku: pembeli.nitku,
      nomorDokumen: g('nodok'),
      negara: g('negara'),
      nama: g('nama') as string,
      alamat: g('alamat') as string,
      email: g('email'),
    },
    item: [],
  }
}

function buatItem(g: (n: string) => string | undefined, hitung: OpsiBaca['hitung']): ItemFaktur {
  const item: ItemFaktur = {
    jenis: jenisItem(g('jenis')?.trim()),
    kode: pad(g('kodebarang')?.trim(), 6),
    nama: g('namabarang') as string,
    satuan: g('satuan') as string,
    harga: bulat2(g('harga')) as string,
    jumlah: bulat2(g('jumlah')) as string,
    diskon: bulat2(g('diskon')),
    tarifPpn: bulat2(g('tarifppn')),
    tarifPpnbm: bulat2(g('tarifppnbm')),
  }
  if (hitung === 'strict') {
    item.dpp = bulat2(g('dpp'))
    item.dppNilaiLain = bulat2(g('dppnl'))
    item.ppn = bulat2(g('ppn'))
    item.ppnbm = bulat2(g('ppnbm'))
  }
  return item
}

// ---------- Template Excel resmi DJP (sheet Faktur + DetailFaktur) ----------

const KOLOM_FAKTUR: Record<string, string> = {
  tanggal: 'Tanggal Faktur',
  kode: 'Kode Transaksi',
  ket: 'Keterangan Tambahan',
  dok: 'Dokumen Pendukung',
  periode: 'Period Dok Pendukung',
  referensi: 'Referensi',
  cap: 'Cap Fasilitas',
  nitkupenjual: 'ID TKU Penjual',
  npwp: 'NPWP/NIK Pembeli',
  jenisid: 'Jenis ID Pembeli',
  negara: 'Negara Pembeli',
  nodok: 'Nomor Dokumen Pembeli',
  nama: 'Nama Pembeli',
  alamat: 'Alamat Pembeli',
  email: 'Email Pembeli',
  nitku: 'ID TKU Pembeli',
}
const KOLOM_DETAIL: Record<string, string> = {
  jenis: 'Barang/Jasa',
  kodebarang: 'Kode Barang Jasa',
  namabarang: 'Nama Barang/Jasa',
  satuan: 'Nama Satuan Ukur',
  harga: 'Harga Satuan',
  jumlah: 'Jumlah Barang Jasa',
  diskon: 'Total Diskon',
  dpp: 'DPP',
  dppnl: 'DPP Nilai Lain',
  tarifppn: 'Tarif PPN',
  ppn: 'PPN',
  tarifppnbm: 'Tarif PPnBM',
  ppnbm: 'PPnBM',
}

/** Baris data: [nomor baris Excel, sel] mulai setelah baris judul (kolom A = "Baris") sampai baris "END". */
function barisData(
  lembar: Lembar,
  nama: string,
): {
  baris: [number, Lembar[number]][]
  ambil: (b: Lembar[number], kunci: string, peta: Record<string, string>) => string | undefined
} {
  const h = lembar.slice(0, 15).findIndex((b) => norm(b?.[0]) === 'baris')
  if (h < 0)
    throw new FormatBerkasError(`Sheet "${nama}": baris judul (kolom A berisi "Baris") tidak ditemukan.`)
  const kolom = new Map<string, number>()
  ;(lembar[h] ?? []).forEach((v, i) => {
    if (v !== undefined) kolom.set(norm(v), i)
  })
  const baris: [number, Lembar[number]][] = []
  for (let i = h + 1; i < lembar.length; i++) {
    const b = lembar[i]
    if (!b || b.every((x) => !x?.trim())) continue
    if (norm(b[0]) === 'end') break
    baris.push([i + 1, b])
  }
  return { baris, ambil: (b, kunci, peta) => b[kolom.get(norm(peta[kunci])) ?? -1]?.trim() }
}

export function dariExcel(sheets: Record<string, Lembar>, opsi: OpsiBaca): HasilBaca {
  const fs = sheets.Faktur
  const ds = sheets.DetailFaktur
  if (!fs || !ds) {
    throw new FormatBerkasError(
      `Sheet "${fs ? 'DetailFaktur' : 'Faktur'}" tidak ditemukan. File ini bukan template Excel faktur pajak keluaran DJP.`,
    )
  }
  const npwpPenjual = fs[0]?.[2]?.trim() ?? ''
  const faktur = barisData(fs, 'Faktur')
  const detail = barisData(ds, 'DetailFaktur')

  const batch: BatchFakturKeluaran = { penjual: { npwp: npwpPenjual, nitku: '' }, faktur: [] }
  const sumber: Sumber = { jenis: 'Excel', faktur: [], item: [] }
  const indeks = new Map<string, number>()
  const nitkuBeda: number[] = []
  for (const [nomor, b] of faktur.baris) {
    const g = (n: string) => faktur.ambil(b, n, KOLOM_FAKTUR)
    const nitku = g('nitkupenjual') ?? ''
    if (batch.faktur.length === 0) batch.penjual.nitku = nitku
    else if (nitku !== batch.penjual.nitku) nitkuBeda.push(nomor)
    indeks.set(b[0]?.trim() ?? '', batch.faktur.length)
    batch.faktur.push(buatFaktur(g, { npwp: g('npwp'), nitku: g('nitku') }))
    sumber.faktur.push(nomor)
    sumber.item.push([])
  }
  if (nitkuBeda.length > 0) {
    throw new FormatBerkasError(
      `ID TKU Penjual harus sama di semua faktur dalam satu file (satu penjual). Berbeda di baris ${nitkuBeda.join(', ')} sheet Faktur.`,
    )
  }

  const yatim: number[] = []
  for (const [nomor, b] of detail.baris) {
    const fi = indeks.get(b[0]?.trim() ?? '')
    if (fi === undefined) {
      yatim.push(nomor)
      continue
    }
    batch.faktur[fi]?.item.push(buatItem((n) => detail.ambil(b, n, KOLOM_DETAIL), opsi.hitung))
    sumber.item[fi]?.push(nomor)
  }
  if (yatim.length > 0) {
    throw new FormatBerkasError(
      `Sheet DetailFaktur baris ${yatim.join(', ')}: nilai kolom Baris tidak ada di sheet Faktur.`,
    )
  }
  return { batch, sumber }
}

// ---------- CSV sederhana: satu baris = satu item, data faktur diulang di setiap baris ----------

export const KOLOM_CSV = [
  'no_faktur',
  'tanggal',
  'kode_transaksi',
  'referensi',
  'keterangan_tambahan',
  'dokumen_pendukung',
  'periode_dokumen',
  'cap_fasilitas',
  'jenis_id_pembeli',
  'npwp_pembeli',
  'nitku_pembeli',
  'nomor_dokumen_pembeli',
  'negara_pembeli',
  'nama_pembeli',
  'alamat_pembeli',
  'email_pembeli',
  'jenis_item',
  'kode_barang',
  'nama_barang',
  'satuan',
  'harga',
  'jumlah',
  'diskon',
  'tarif_ppn',
  'tarif_ppnbm',
  'dpp',
  'dpp_nilai_lain',
  'ppn',
  'ppnbm',
  'npwp_penjual',
  'nitku_penjual',
] as const

const WAJIB_CSV = [
  'no_faktur',
  'tanggal',
  'kode_transaksi',
  'jenis_id_pembeli',
  'nama_barang',
  'harga',
  'jumlah',
  'npwp_penjual',
  'nitku_penjual',
]

const CSV_KE_KUNCI: Record<string, string> = {
  tanggal: 'tanggal',
  kode_transaksi: 'kode',
  referensi: 'referensi',
  keterangan_tambahan: 'ket',
  dokumen_pendukung: 'dok',
  periode_dokumen: 'periode',
  cap_fasilitas: 'cap',
  jenis_id_pembeli: 'jenisid',
  nomor_dokumen_pembeli: 'nodok',
  negara_pembeli: 'negara',
  nama_pembeli: 'nama',
  alamat_pembeli: 'alamat',
  email_pembeli: 'email',
  jenis_item: 'jenis',
  kode_barang: 'kodebarang',
  nama_barang: 'namabarang',
  satuan: 'satuan',
  harga: 'harga',
  jumlah: 'jumlah',
  diskon: 'diskon',
  tarif_ppn: 'tarifppn',
  tarif_ppnbm: 'tarifppnbm',
  dpp: 'dpp',
  dpp_nilai_lain: 'dppnl',
  ppn: 'ppn',
  ppnbm: 'ppnbm',
}

/** Contoh CSV kosong dengan satu baris isi rekaan (NPWP nol), untuk perintah `template`. */
export function templateCsv(): string {
  const contoh: Record<string, string> = {
    no_faktur: 'INV-001',
    tanggal: '2026-10-01',
    kode_transaksi: '04',
    referensi: 'INV-001',
    jenis_id_pembeli: 'TIN',
    npwp_pembeli: '0000000000000000',
    nitku_pembeli: '0000000000000000000000',
    negara_pembeli: 'IDN',
    nama_pembeli: 'PT Contoh Pembeli',
    alamat_pembeli: '"Jl. Contoh No. 1, Jakarta"',
    jenis_item: 'jasa',
    nama_barang: 'Jasa Konsultasi',
    satuan: 'UM.0033',
    harga: '600000',
    jumlah: '2',
    npwp_penjual: '0000000000000000',
    nitku_penjual: '0000000000000000000000',
  }
  return `${KOLOM_CSV.join(',')}\n${KOLOM_CSV.map((k) => contoh[k] ?? '').join(',')}\n`
}

export function dariCsv(teks: string, opsi: OpsiBaca): HasilBaca {
  const rows = parseCsv(teks)
  const judul = (rows[0] ?? []).map(norm)
  const hilang = WAJIB_CSV.filter((k) => !judul.includes(k))
  if (hilang.length > 0) {
    throw new FormatBerkasError(
      `Kolom wajib tidak ada di CSV: ${hilang.join(', ')}. Buat contoh dengan: coretax-xml template faktur-keluaran`,
    )
  }
  const ambil = (b: string[], nama: string) => b[judul.indexOf(nama)]?.trim()

  const batch: BatchFakturKeluaran = { penjual: { npwp: '', nitku: '' }, faktur: [] }
  const sumber: Sumber = { jenis: 'CSV', faktur: [], item: [] }
  const indeks = new Map<string, number>()
  const penjualBeda: number[] = []
  rows.forEach((b, i) => {
    if (i === 0 || b.every((x) => !x.trim())) return
    const nomor = i + 1
    const npwp = ambil(b, 'npwp_penjual') ?? ''
    const nitku = ambil(b, 'nitku_penjual') ?? ''
    if (batch.faktur.length === 0 && indeks.size === 0) batch.penjual = { npwp, nitku }
    else if (npwp !== batch.penjual.npwp || nitku !== batch.penjual.nitku) penjualBeda.push(nomor)
    const kunci = ambil(b, 'no_faktur') ?? ''
    const g = (n: string) => {
      const kolom = Object.entries(CSV_KE_KUNCI).find(([, k]) => k === n)?.[0]
      return kolom ? ambil(b, kolom) : undefined
    }
    let fi = indeks.get(kunci)
    if (fi === undefined) {
      fi = batch.faktur.length
      indeks.set(kunci, fi)
      batch.faktur.push(buatFaktur(g, { npwp: ambil(b, 'npwp_pembeli'), nitku: ambil(b, 'nitku_pembeli') }))
      sumber.faktur.push(nomor)
      sumber.item.push([])
    }
    batch.faktur[fi]?.item.push(buatItem(g, opsi.hitung))
    sumber.item[fi]?.push(nomor)
  })
  if (penjualBeda.length > 0) {
    throw new FormatBerkasError(
      `npwp_penjual dan nitku_penjual harus sama di semua baris (satu penjual per file). Berbeda di baris ${penjualBeda.join(', ')}.`,
    )
  }
  return { batch, sumber }
}
