import { analisis } from './faktur-keluaran.js'
import { teks } from './messages.js'
import { elemenFaktur, elemenItem } from './schemas/faktur-keluaran/v2025-09.js'
import type {
  Bahasa,
  BatchFakturKeluaran,
  FakturKeluaran,
  HasilValidasi,
  ItemFaktur,
  KodeError,
  MasalahValidasi,
  OpsiValidasi,
} from './types.js'

/** Pembaca XML minimal untuk dokumen impor Coretax: elemen, atribut diabaikan, entitas, CDATA, komentar. */
export interface Node {
  nama: string
  anak: Node[]
  teks: string
}

export class XmlParseError extends Error {
  constructor(
    message: string,
    readonly posisi: number,
  ) {
    super(message)
  }
}

const ENTITAS: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const dekode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (e.startsWith('#')) {
      const kode = /^#x/i.test(e) ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10)
      return kode >= 0 && kode <= 0x10ffff ? String.fromCodePoint(kode) : ''
    }
    return ENTITAS[e.toLowerCase()] ?? ''
  })

// komentar | instruksi (<?xml?>) | CDATA | tag buka/tutup/kosong | teks
const TOKEN =
  /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|([^<]+)/y

export function parseXml(xml: string): Node {
  const s = xml.charCodeAt(0) === 0xfeff ? xml.slice(1) : xml
  const tumpukan: Node[] = []
  let akar: Node | undefined
  let pos = 0
  while (pos < s.length) {
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(s)
    if (!m) throw new XmlParseError('karakter tidak dikenal', pos)
    const atas = tumpukan.at(-1)
    if (m[3] !== undefined) {
      if (m[2]) {
        if (!atas || atas.nama !== m[3]) {
          throw new XmlParseError(`tag penutup </${m[3]}> tidak cocok dengan tag pembuka`, pos)
        }
        tumpukan.pop()
      } else {
        const node: Node = { nama: m[3], anak: [], teks: '' }
        if (atas) atas.anak.push(node)
        else if (akar) throw new XmlParseError('lebih dari satu elemen akar', pos)
        else akar = node
        if (!m[5]) tumpukan.push(node)
      }
    } else if (m[1] !== undefined) {
      if (atas) atas.teks += m[1]
    } else if (m[6] !== undefined) {
      if (atas) atas.teks += dekode(m[6])
      else if (m[6].trim()) throw new XmlParseError('teks di luar elemen akar', pos)
    }
    pos = TOKEN.lastIndex
  }
  if (tumpukan.length > 0) throw new XmlParseError(`tag <${tumpukan.at(-1)?.nama}> tidak ditutup`, pos)
  if (!akar) throw new XmlParseError('tidak ada elemen', 0)
  return akar
}

export const anak = (n: Node | undefined, nama: string) => n?.anak.find((a) => a.nama === nama)
export const nilai = (n: Node | undefined, nama: string) => anak(n, nama)?.teks.trim() ?? ''

function keItem(n: Node): ItemFaktur {
  const opt = nilai(n, 'Opt')
  return {
    jenis: (opt === 'A' ? 'barang' : opt === 'B' ? 'jasa' : opt) as ItemFaktur['jenis'],
    kode: nilai(n, 'Code'),
    nama: nilai(n, 'Name'),
    satuan: nilai(n, 'Unit'),
    harga: nilai(n, 'Price'),
    jumlah: nilai(n, 'Qty'),
    diskon: nilai(n, 'TotalDiscount'),
    dpp: nilai(n, 'TaxBase'),
    dppNilaiLain: nilai(n, 'OtherTaxBase'),
    tarifPpn: nilai(n, 'VATRate'),
    ppn: nilai(n, 'VAT'),
    tarifPpnbm: nilai(n, 'STLGRate'),
    ppnbm: nilai(n, 'STLG'),
  }
}

function keFaktur(n: Node): FakturKeluaran {
  const daftar = anak(n, 'ListOfGoodService')?.anak.filter((a) => a.nama === 'GoodService') ?? []
  return {
    tanggal: nilai(n, 'TaxInvoiceDate'),
    kodeTransaksi: nilai(n, 'TrxCode') as FakturKeluaran['kodeTransaksi'],
    keteranganTambahan: nilai(n, 'AddInfo'),
    dokumenPendukung: nilai(n, 'CustomDoc'),
    periodeDokumenPendukung: nilai(n, 'CustomDocMonthYear'),
    referensi: nilai(n, 'RefDesc'),
    capFasilitas: nilai(n, 'FacilityStamp'),
    pembeli: {
      jenisId: nilai(n, 'BuyerDocument') as FakturKeluaran['pembeli']['jenisId'],
      npwp: nilai(n, 'BuyerTin'),
      nitku: nilai(n, 'BuyerIDTKU'),
      negara: nilai(n, 'BuyerCountry'),
      nomorDokumen: nilai(n, 'BuyerDocumentNumber'),
      nama: nilai(n, 'BuyerName'),
      alamat: nilai(n, 'BuyerAdress'),
      email: nilai(n, 'BuyerEmail'),
    },
    item: daftar.map(keItem),
  }
}

export type Tambah = (
  code: KodeError,
  element: string | null,
  faktur: number | null,
  item: number | null,
  param?: Record<string, string | number>,
) => void

/** Pengumpul error struktur XML: setiap panggilan menambah satu error berlokasi (field "xml"). */
export function pengumpulXml(bahasa: Bahasa): { errors: MasalahValidasi[]; tambah: Tambah } {
  const errors: MasalahValidasi[] = []
  const tambah: Tambah = (code, element, faktur, item, param = {}) => {
    const { pesan, saran } = teks(bahasa, code, param)
    errors.push({
      code,
      level: 'error',
      faktur,
      item,
      field: 'xml',
      element,
      pesan,
      ...(saran ? { saran } : {}),
    })
  }
  return { errors, tambah }
}

/** Periksa anak langsung sebuah elemen: elemen wajib hilang, elemen asing, dan urutan. */
export function periksaElemen(
  tambah: Tambah,
  n: Node,
  harapan: readonly string[],
  lokasi: string,
  faktur: number | null,
  item: number | null,
) {
  const ada = n.anak.map((a) => a.nama)
  for (const nama of harapan.filter((h) => !ada.includes(h))) {
    tambah('XML_ELEMENT_MISSING', nama, faktur, item, { lokasi, nama })
  }
  for (const nama of ada.filter((a) => !harapan.includes(a))) {
    tambah('XML_ELEMENT_UNKNOWN', nama, faktur, item, { lokasi, nama })
  }
  // elemen yang berulang berurutan (mis. <Rows> banyak kali) dihitung satu
  const dikenal = ada.filter((a, i) => harapan.includes(a) && a !== ada[i - 1])
  if (dikenal.join() !== harapan.filter((h) => ada.includes(h)).join()) {
    tambah('XML_ELEMENT_ORDER', null, faktur, item, { lokasi, urutan: harapan.join(', ') })
  }
}

/**
 * Periksa file XML faktur pajak keluaran yang sudah ada (buatan converter DJP, library ini, atau aplikasi lain).
 * Memeriksa struktur (elemen wajib dan urutannya), lalu isi dengan aturan yang sama seperti `validate`
 * dalam mode strict: semua angka dibaca dari file dan dicocokkan dengan hitungan.
 */
export function check(xml: string, opsi: OpsiValidasi = {}): HasilValidasi {
  const bahasa: Bahasa = opsi.bahasa ?? 'id'
  const { errors, tambah } = pengumpulXml(bahasa)
  const gagal = (): HasilValidasi => ({
    valid: false,
    schema: `faktur-keluaran@${opsi.schema ?? 'auto'}`,
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
  if (akar.nama !== 'TaxInvoiceBulk') {
    tambah('XML_ROOT', akar.nama, null, null, { nama: akar.nama, harap: 'TaxInvoiceBulk' })
    return gagal()
  }

  const awalan = bahasa === 'id' ? 'Faktur ke-' : 'Invoice #'
  const periksa = (
    n: Node,
    harapan: readonly string[],
    lokasi: string,
    faktur: number | null,
    item: number | null,
  ) => periksaElemen(tambah, n, harapan, lokasi, faktur, item)

  periksa(akar, ['TIN', 'ListOfTaxInvoice'], '<TaxInvoiceBulk>', null, null)
  const daftar = anak(akar, 'ListOfTaxInvoice')?.anak.filter((a) => a.nama === 'TaxInvoice') ?? []
  const nitkuPertama = nilai(daftar[0], 'SellerIDTKU')
  daftar.forEach((f, i) => {
    const nf = i + 1
    periksa(f, [...elemenFaktur, 'ListOfGoodService'], `${awalan}${nf}`, nf, null)
    if (nilai(f, 'SellerIDTKU') !== nitkuPertama)
      tambah('XML_SELLER_MISMATCH', 'SellerIDTKU', nf, null, { faktur: nf })
    const barang = anak(f, 'ListOfGoodService')?.anak.filter((a) => a.nama === 'GoodService') ?? []
    barang.forEach((b, j) => {
      const lokasi = bahasa === 'id' ? `Faktur ke-${nf}, item ${j + 1}` : `Invoice #${nf}, item ${j + 1}`
      periksa(b, elemenItem, lokasi, nf, j + 1)
    })
  })

  const batch: BatchFakturKeluaran = {
    penjual: { npwp: nilai(akar, 'TIN'), nitku: nitkuPertama },
    faktur: daftar.map(keFaktur),
  }
  const isi = analisis(batch, { ...opsi, hitung: 'strict' }).hasil
  const semua = [...errors, ...isi.errors]
  return { valid: semua.length === 0, schema: isi.schema, errors: semua, warnings: isi.warnings }
}
