import {
  bacaAngka,
  CoretaxValidationError,
  type Lokasi,
  Pengumpul,
  periksaDigit,
  tanggalValid,
  wajibTeks,
} from './faktur-keluaran.js'
import { bulatRupiahGenap, formatRupiah, formatXml, kali, type Sen } from './money.js'
import { satuan as daftarSatuan } from './schemas/faktur-keluaran/v2025-09.js'
import {
  elemenBaris,
  elemenDokumen,
  elemenFooter,
  meta,
  PANJANG_NOMOR_FAKTUR,
  pasanganFooter,
} from './schemas/retur-masukan/v2025-03.js'
import type { Angka, Bahasa, HasilValidasi, OpsiValidasi } from './types.js'
import { escapeXml } from './xml.js'
import { anak, type Node, nilai, parseXml, pengumpulXml, periksaElemen, XmlParseError } from './xml-baca.js'

export interface ItemRetur {
  jenis: 'barang' | 'jasa'
  nama: string
  /** Kode barang/jasa 6 digit, sama dengan faktur asal. Default '000000'. */
  kode?: string
  /** Jumlah pada faktur asal (`Quantity`). */
  jumlah: Angka
  satuan: string
  /** Harga satuan pada faktur asal (`UnitPrice`). */
  harga: Angka
  tarifPpnbm?: Angka
  /** Jumlah yang diretur. Tidak boleh melebihi `jumlah`. */
  jumlahRetur: Angka
  diskonRetur?: Angka
  /** DPP retur. Jika kosong: jumlahRetur x harga - diskonRetur. */
  dpp?: Angka
  /** true jika faktur asal memakai DPP nilai lain (Flag DPP Lain = Yes). */
  pakaiDppLain?: boolean
  /** DPP nilai lain retur. Wajib jika pakaiDppLain; jika tidak, sama dengan dpp. */
  dppLain?: Angka
  /** PPN retur. Wajib diisi: tarif PPN tidak ada di template retur, jadi tidak bisa dihitung library. */
  ppn: Angka
  ppnbm?: Angka
}

export interface ReturFakturMasukan {
  /** Nomor faktur pajak masukan yang diretur, 17 digit. */
  nomorFaktur: string
  /** NPWP penjual (pemilik faktur), 16 digit. */
  npwpPenjual: string
  /** Tanggal retur, YYYY-MM-DD (ditulis sebagai DD-MM-YYYY di XML). */
  tanggal: string
  /** Total dokumen. Jika kosong: jumlah semua item; jika diisi dan berbeda, diberi peringatan. */
  dpp?: Angka
  dppLain?: Angka
  ppn?: Angka
  ppnbm?: Angka
  item: ItemRetur[]
}

export interface BatchReturFakturMasukan {
  /** NPWP pembeli (pelapor retur), 16 digit. Ditulis ke `TIN`. */
  pembeli: { npwp: string }
  retur: ReturFakturMasukan[]
}

interface ItemTerhitung {
  jenis: 'A' | 'B'
  nama: string
  kode: string
  jumlah: Sen
  satuan: string
  harga: Sen
  tarifPpnbm: Sen
  jumlahRetur: Sen
  diskonRetur: Sen
  dpp: Sen
  dppLain: Sen
  pakaiDppLain: boolean
  ppn: Sen
  ppnbm: Sen
}

interface ReturTerhitung {
  nomorFaktur: string
  npwpPenjual: string
  tanggal: string
  dpp: Sen
  dppLain: Sen
  ppn: Sen
  ppnbm: Sen
  item: ItemTerhitung[]
}

export interface AnalisisRetur {
  hasil: HasilValidasi
  tin: string
  retur: ReturTerhitung[]
}

/** Label yang berbeda dari faktur keluaran untuk field yang namanya sama. */
const LABEL_RETUR = {
  id: { tanggal: 'Tanggal retur', jumlah: 'Jumlah pada faktur asal' },
  en: { tanggal: 'Return date', jumlah: 'Quantity on the original invoice' },
}

const jumlahSen = (daftar: Sen[]) => daftar.reduce((a, b) => a + b, 0n)

function analisisItem(k: Pengumpul, it: ItemRetur, nr: number, ni: number): ItemTerhitung | null {
  const loc = (field: string, element: string | null): Lokasi => ({
    faktur: nr,
    item: ni,
    field: `item[${ni - 1}].${field}`,
    element,
  })
  let jenis: 'A' | 'B' = 'A'
  if (it.jenis === 'barang') jenis = 'A'
  else if (it.jenis === 'jasa') jenis = 'B'
  else
    k.tambah(
      'error',
      'ITEM_TYPE_UNKNOWN',
      loc('jenis', 'Type'),
      { nilai: String(it.jenis) },
      String(it.jenis),
    )

  let kode = (it.kode ?? '').trim()
  if (!kode) kode = '000000'
  else if (!/^\d{6}$/.test(kode))
    k.tambah('error', 'GOODS_CODE_FORMAT', loc('kode', 'Code'), { nilai: kode }, kode)

  const nama = wajibTeks(k, it.nama, loc('nama', 'Name'))
  const unit = (it.satuan ?? '').trim()
  if (!unit) k.tambah('error', 'REQUIRED', loc('satuan', 'Unit'))
  else if (!(unit in daftarSatuan)) {
    k.tambah('error', 'UNIT_UNKNOWN', loc('satuan', 'Unit'), { nilai: unit, skema: meta.id }, unit)
  }

  const jumlah = bacaAngka(k, it.jumlah, loc('jumlah', 'Quantity'), { wajib: true })
  const harga = bacaAngka(k, it.harga, loc('harga', 'UnitPrice'), { wajib: true })
  const tarifBm = bacaAngka(k, it.tarifPpnbm, loc('tarifPpnbm', 'STLGRate'), { bawaan: 0 })
  const jumlahRetur = bacaAngka(k, it.jumlahRetur, loc('jumlahRetur', 'ReturnQuantity'), { wajib: true })
  const diskon = bacaAngka(k, it.diskonRetur, loc('diskonRetur', 'ReturnDiscount'), { bawaan: 0 })
  const dppInput = bacaAngka(k, it.dpp, loc('dpp', 'ReturnTaxBase'))
  const dppLainInput = bacaAngka(k, it.dppLain, loc('dppLain', 'ReturnOtherTaxBase'))
  const ppn = bacaAngka(k, it.ppn, loc('ppn', 'ReturnVAT'), { wajib: true })
  const ppnbm = bacaAngka(k, it.ppnbm, loc('ppnbm', 'ReturnSTLG'), { bawaan: 0 })

  if (jumlahRetur !== null && jumlahRetur === 0n)
    k.tambah('error', 'QTY_ZERO', loc('jumlahRetur', 'ReturnQuantity'))
  if (jumlah !== null && jumlahRetur !== null && jumlahRetur > jumlah) {
    k.tambah('error', 'RETUR_QTY_EXCEEDS', loc('jumlahRetur', 'ReturnQuantity'), {
      retur: formatRupiah(jumlahRetur),
      jumlah: formatRupiah(jumlah),
    })
  }
  if (jumlah === null || harga === null || jumlahRetur === null || diskon === null || tarifBm === null)
    return null
  if (ppn === null || ppnbm === null) return null

  const bruto = kali(harga, jumlahRetur)
  if (diskon > bruto) {
    k.tambah('error', 'DISCOUNT_TOO_LARGE', loc('diskonRetur', 'ReturnDiscount'), {
      diskon: formatRupiah(diskon),
      total: formatRupiah(bruto),
    })
    return null
  }
  const dppHitung = bruto - diskon
  const dpp = dppInput ?? dppHitung
  if (dppInput !== null && dppInput !== dppHitung) {
    k.tambah('warning', 'RETUR_DPP_MISMATCH', loc('dpp', 'ReturnTaxBase'), {
      nilai: formatRupiah(dppInput),
      harap: formatRupiah(dppHitung),
    })
  }

  const pakai = it.pakaiDppLain === true
  let dppLain = dpp
  if (pakai) {
    if (dppLainInput === null) k.tambah('error', 'REQUIRED', loc('dppLain', 'ReturnOtherTaxBase'))
    else dppLain = dppLainInput
  } else if (dppLainInput !== null && dppLainInput !== dpp) {
    // Sheet Keterangan DJP: "isikan dengan nilai yang sama dengan DPP Retur jika Flag DPP Lain bernilai Tidak"
    k.tambah('error', 'RETUR_OTHER_BASE_MISMATCH', loc('dppLain', 'ReturnOtherTaxBase'), {
      dppLain: formatRupiah(dppLainInput),
      dpp: formatRupiah(dpp),
    })
  }

  return {
    jenis,
    nama,
    kode,
    jumlah,
    satuan: unit,
    harga,
    tarifPpnbm: tarifBm,
    jumlahRetur,
    diskonRetur: diskon,
    dpp,
    dppLain,
    pakaiDppLain: pakai,
    ppn,
    ppnbm,
  }
}

function analisisRetur(k: Pengumpul, r: ReturFakturMasukan, nr: number): ReturTerhitung {
  const loc = (field: string, element: string | null): Lokasi => ({ faktur: nr, item: null, field, element })

  const nomor = (r.nomorFaktur ?? '').trim()
  if (!nomor) k.tambah('error', 'REQUIRED', loc('nomorFaktur', 'InvoiceNumber'))
  else if (nomor.length !== PANJANG_NOMOR_FAKTUR || !/^\d+$/.test(nomor)) {
    k.tambah('error', 'INVOICE_NUMBER_FORMAT', loc('nomorFaktur', 'InvoiceNumber'), { nilai: nomor }, nomor)
  }
  const npwpPenjual = periksaDigit(k, r.npwpPenjual, 16, loc('npwpPenjual', 'SellerTIN'))
  const tanggal = (r.tanggal ?? '').trim()
  if (!tanggal) k.tambah('error', 'REQUIRED', loc('tanggal', 'ReturnDate'))
  else if (!tanggalValid(tanggal)) {
    k.tambah('error', 'DATE_FORMAT', loc('tanggal', 'ReturnDate'), { nilai: tanggal }, tanggal)
  }

  const item: ItemTerhitung[] = []
  if (!Array.isArray(r.item) || r.item.length === 0) {
    k.tambah('error', 'ITEMS_EMPTY', loc('item', 'TransactionDetailsData'))
  } else {
    r.item.forEach((it, i) => {
      const hasil = analisisItem(k, it, nr, i + 1)
      if (hasil) item.push(hasil)
    })
  }

  // Total dokumen: jumlah semua item; nilai yang diisi dan berbeda hanya diperingatkan (aturan DJP belum terkonfirmasi)
  const total = (
    input: Angka | undefined,
    field: string,
    element: string,
    dari: (i: ItemTerhitung) => Sen,
  ) => {
    const hitung = jumlahSen(item.map(dari))
    const sen = bacaAngka(k, input, loc(field, element))
    // Total yang diisi dalam rupiah utuh (seperti kolom Total di Excel DJP) tidak dianggap selisih
    if (sen !== null && item.length > 0 && sen !== hitung && sen !== bulatRupiahGenap(hitung)) {
      k.tambah('warning', 'RETUR_TOTAL_MISMATCH', loc(field, element), {
        nilai: formatRupiah(sen),
        harap: formatRupiah(hitung),
      })
    }
    return sen ?? hitung
  }
  return {
    nomorFaktur: nomor,
    npwpPenjual,
    tanggal,
    dpp: total(r.dpp, 'dpp', 'ReturnTaxBase', (i) => i.dpp),
    dppLain: total(r.dppLain, 'dppLain', 'ReturnOtherTaxBase', (i) => i.dppLain),
    ppn: total(r.ppn, 'ppn', 'ReturnVAT', (i) => i.ppn),
    ppnbm: total(r.ppnbm, 'ppnbm', 'ReturnSTLG', (i) => i.ppnbm),
    item,
  }
}

export function analisis(batch: BatchReturFakturMasukan, opsi: OpsiValidasi = {}): AnalisisRetur {
  const k = new Pengumpul(opsi.bahasa ?? 'id', opsi.samarkan ?? true, undefined, LABEL_RETUR)
  const idSkema = `retur-masukan@${meta.id}`
  if (opsi.schema !== undefined && opsi.schema !== 'auto' && opsi.schema !== meta.id) {
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
      retur: [],
    }
  }
  const tin = periksaDigit(k, batch?.pembeli?.npwp, 16, {
    faktur: null,
    item: null,
    field: 'pembeli.npwp',
    element: 'TIN',
  })
  const daftar = Array.isArray(batch?.retur) ? batch.retur : []
  if (daftar.length === 0) {
    k.tambah('error', 'RETUR_EMPTY', {
      faktur: null,
      item: null,
      field: 'retur',
      element: 'InputReturnDataList',
    })
  }
  const retur = daftar.map((r, i) => analisisRetur(k, r, i + 1))
  return {
    hasil: { valid: k.errors.length === 0, schema: idSkema, errors: k.errors, warnings: k.warnings },
    tin,
    retur,
  }
}

export function validate(batch: BatchReturFakturMasukan, opsi: OpsiValidasi = {}): HasilValidasi {
  return analisis(batch, opsi).hasil
}

/** Total dokumen dan FooterRow ditulis dalam rupiah utuh, seperti converter DJP. */
const rupiah = (s: Sen) => formatXml(bulatRupiahGenap(s))

const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`

function tulisXmlRetur(tin: string, retur: ReturTerhitung[]): string {
  const t = (indent: string, nama: string, isi: string) =>
    isi === '' ? `${indent}<${nama}/>` : `${indent}<${nama}>${escapeXml(isi)}</${nama}>`
  const baris: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<InputTaxInvoiceReturn>',
    t('  ', 'TIN', tin),
    '  <InputReturnDataList>',
  ]
  for (const r of retur) {
    baris.push('    <InputReturnData>', '      <TransactionDocumentData>')
    const dok: Record<(typeof elemenDokumen)[number], string> = {
      InvoiceNumber: r.nomorFaktur,
      SellerTIN: r.npwpPenjual,
      ReturnDate: ddmmyyyy(r.tanggal),
      ReturnTaxBase: rupiah(r.dpp),
      ReturnOtherTaxBase: rupiah(r.dppLain),
      ReturnVAT: rupiah(r.ppn),
      ReturnSTLG: rupiah(r.ppnbm),
    }
    for (const n of elemenDokumen) baris.push(t('        ', n, dok[n]))
    baris.push('      </TransactionDocumentData>', '      <TransactionDetailsData>')
    for (const it of r.item) {
      const b: Record<(typeof elemenBaris)[number], string> = {
        Type: it.jenis,
        Name: it.nama,
        Code: it.kode,
        Quantity: formatXml(it.jumlah),
        Unit: it.satuan,
        UnitPrice: formatXml(it.harga),
        STLGRate: formatXml(it.tarifPpnbm),
        ReturnQuantity: formatXml(it.jumlahRetur),
        ReturnDiscount: formatXml(it.diskonRetur),
        ReturnTaxBase: formatXml(it.dpp),
        ReturnOtherTaxBase: formatXml(it.dppLain),
        ReturnOtherTaxBaseCheck: it.pakaiDppLain ? 'true' : 'false',
        ReturnVAT: formatXml(it.ppn),
        ReturnSTLG: formatXml(it.ppnbm),
      }
      baris.push('        <Rows>')
      for (const n of elemenBaris) baris.push(t('          ', n, b[n]))
      baris.push('        </Rows>')
    }
    const footer: Record<(typeof elemenFooter)[number], string> = {
      ReturnTaxBaseTotal: rupiah(r.dpp),
      ReturnOtherTaxBaseTotal: rupiah(r.dppLain),
      ReturnVATTotal: rupiah(r.ppn),
      ReturnSTLGTotal: rupiah(r.ppnbm),
    }
    baris.push('        <FooterRow>')
    for (const n of elemenFooter) baris.push(t('          ', n, footer[n]))
    baris.push('        </FooterRow>', '      </TransactionDetailsData>', '    </InputReturnData>')
  }
  baris.push('  </InputReturnDataList>', '</InputTaxInvoiceReturn>', '')
  return baris.join('\n')
}

/** Buat XML retur faktur pajak masukan. Melempar CoretaxValidationError jika data tidak valid. */
export function build(batch: BatchReturFakturMasukan, opsi: OpsiValidasi = {}): string {
  const a = analisis(batch, opsi)
  if (!a.hasil.valid) throw new CoretaxValidationError(a.hasil)
  return tulisXmlRetur(a.tin, a.retur)
}

const tanggalDariXml = (s: string) => {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(s)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s // selain DD-MM-YYYY dilaporkan di bawah; yang bukan tanggal juga oleh DATE_FORMAT
}

/** Periksa file XML retur faktur pajak masukan yang sudah ada: struktur, isi, dan kesamaan FooterRow dengan nilai dokumen. */
export function check(xml: string, opsi: OpsiValidasi = {}): HasilValidasi {
  const bahasa: Bahasa = opsi.bahasa ?? 'id'
  const { errors, tambah } = pengumpulXml(bahasa)
  const gagal = (): HasilValidasi => ({
    valid: false,
    schema: `retur-masukan@${meta.id}`,
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
  if (akar.nama !== 'InputTaxInvoiceReturn') {
    tambah('XML_ROOT', akar.nama, null, null, { nama: akar.nama, harap: 'InputTaxInvoiceReturn' })
    return gagal()
  }

  const awalan = bahasa === 'id' ? 'Retur ke-' : 'Return #'
  periksaElemen(tambah, akar, ['TIN', 'InputReturnDataList'], '<InputTaxInvoiceReturn>', null, null)
  const daftar = anak(akar, 'InputReturnDataList')?.anak.filter((a) => a.nama === 'InputReturnData') ?? []
  const batch: BatchReturFakturMasukan = { pembeli: { npwp: nilai(akar, 'TIN') }, retur: [] }
  const benar = (v: string) => v === 'true' || v === 'false'

  daftar.forEach((d, i) => {
    const nr = i + 1
    const lokasi = `${awalan}${nr}`
    periksaElemen(tambah, d, ['TransactionDocumentData', 'TransactionDetailsData'], lokasi, nr, null)
    const dok = anak(d, 'TransactionDocumentData')
    const rinci = anak(d, 'TransactionDetailsData')
    if (dok) periksaElemen(tambah, dok, elemenDokumen, lokasi, nr, null)
    const barisNode = rinci?.anak.filter((a) => a.nama === 'Rows') ?? []
    const footer = anak(rinci, 'FooterRow')
    if (rinci) {
      periksaElemen(tambah, rinci, ['Rows', 'FooterRow'], lokasi, nr, null)
    }
    if (footer) periksaElemen(tambah, footer, elemenFooter, lokasi, nr, null)

    const item: ItemRetur[] = barisNode.map((b, j) => {
      periksaElemen(tambah, b, elemenBaris, `${lokasi}, item ${j + 1}`, nr, j + 1)
      const cek = nilai(b, 'ReturnOtherTaxBaseCheck')
      if (cek !== '' && !benar(cek))
        tambah('RETUR_BOOL_FORMAT', 'ReturnOtherTaxBaseCheck', nr, j + 1, { nilai: cek })
      const opt = nilai(b, 'Type')
      return {
        jenis: (opt === 'A' ? 'barang' : opt === 'B' ? 'jasa' : opt) as ItemRetur['jenis'],
        nama: nilai(b, 'Name'),
        kode: nilai(b, 'Code'),
        jumlah: nilai(b, 'Quantity'),
        satuan: nilai(b, 'Unit'),
        harga: nilai(b, 'UnitPrice'),
        tarifPpnbm: nilai(b, 'STLGRate'),
        jumlahRetur: nilai(b, 'ReturnQuantity'),
        diskonRetur: nilai(b, 'ReturnDiscount'),
        dpp: nilai(b, 'ReturnTaxBase'),
        pakaiDppLain: cek === 'true',
        dppLain: nilai(b, 'ReturnOtherTaxBase'),
        ppn: nilai(b, 'ReturnVAT'),
        ppnbm: nilai(b, 'ReturnSTLG'),
      }
    })

    // FooterRow harus sama dengan nilai dokumen (sheet Keterangan: "Diisi sama dengan ...")
    if (dok && footer) {
      for (const [elemenDok, elemenFoot] of pasanganFooter) {
        const a = nilai(dok, elemenDok)
        const b = nilai(footer, elemenFoot)
        if (a !== '' && b !== '' && a !== b) {
          tambah('RETUR_FOOTER_MISMATCH', elemenFoot, nr, null, { elemen: elemenFoot, nilai: b, harap: a })
        }
      }
    }
    const tgl = nilai(dok, 'ReturnDate')
    if (/^\d{4}-\d{2}-\d{2}$/.test(tgl)) tambah('RETUR_DATE_FORMAT', 'ReturnDate', nr, null, { nilai: tgl })
    batch.retur.push({
      nomorFaktur: nilai(dok, 'InvoiceNumber'),
      npwpPenjual: nilai(dok, 'SellerTIN'),
      tanggal: tanggalDariXml(nilai(dok, 'ReturnDate')),
      dpp: nilai(dok, 'ReturnTaxBase'),
      dppLain: nilai(dok, 'ReturnOtherTaxBase'),
      ppn: nilai(dok, 'ReturnVAT'),
      ppnbm: nilai(dok, 'ReturnSTLG'),
      item,
    })
  })

  const isi = analisis(batch, opsi).hasil
  const semua = [...errors, ...isi.errors]
  return { valid: semua.length === 0, schema: isi.schema, errors: semua, warnings: isi.warnings }
}
