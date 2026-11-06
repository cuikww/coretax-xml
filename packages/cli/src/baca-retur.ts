import type { BatchReturFakturMasukan, ItemRetur, ReturFakturMasukan } from 'coretax-xml'
import { bulat2, tanggalIso } from './angka.js'
import { barisData, FormatBerkasError, jenisItem, type OpsiBaca, pad, type Sumber } from './baca-faktur.js'
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
