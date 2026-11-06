import { strFromU8, unzipSync } from 'fflate'

/** Satu lembar: lembar[baris][kolom], indeks mulai 0. Semua nilai berupa teks apa adanya dari file (angka tidak diubah). */
export type Lembar = (string | undefined)[][]

const ENTITAS: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
const dekode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    if (!e.startsWith('#')) return ENTITAS[e.toLowerCase()] ?? ''
    const kode = /^#x/i.test(e) ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10)
    return kode >= 0 && kode <= 0x10ffff ? String.fromCodePoint(kode) : ''
  })

const atribut = (tag: string) => {
  const hasil: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    hasil[m[1] as string] = dekode(m[2] ?? m[3] ?? '')
  return hasil
}

const gabungTeks = (xml: string) =>
  [...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => dekode(m[1] ?? ''))
    .join('')

function indeksKolom(huruf: string): number {
  let n = 0
  for (const c of huruf) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}

/**
 * Baca file .xlsx menjadi {namaSheet: lembar}. Hanya nilai sel: untuk sel berumus yang dibaca adalah hasil
 * hitung yang tersimpan di file. Rumus tidak dihitung ulang.
 */
export function bacaXlsx(data: Uint8Array): Record<string, Lembar> {
  let berkas: Record<string, Uint8Array>
  try {
    berkas = unzipSync(data, {
      filter: (f) =>
        /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(
          f.name,
        ),
    })
  } catch {
    throw new Error('Bukan file .xlsx yang valid (bukan arsip zip).')
  }
  const teks = (p: string) => (berkas[p] ? strFromU8(berkas[p]) : undefined)
  const wb = teks('xl/workbook.xml')
  if (!wb)
    throw new Error('Bukan file .xlsx yang valid (xl/workbook.xml tidak ada). File .xls lama tidak didukung.')

  const sst = [...(teks('xl/sharedStrings.xml') ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    gabungTeks(m[1] ?? ''),
  )
  const rels: Record<string, string> = {}
  for (const m of (teks('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\s[^>]*>/g)) {
    const a = atribut(m[0])
    if (a.Id && a.Target) rels[a.Id] = a.Target.replace(/^\/?(xl\/)?/, 'xl/')
  }

  const hasil: Record<string, Lembar> = {}
  for (const m of wb.matchAll(/<sheet\s[^>]*>/g)) {
    const a = atribut(m[0])
    const xml = a.name && a['r:id'] ? teks(rels[a['r:id']] ?? '') : undefined
    if (!a.name || xml === undefined) continue
    const lembar: Lembar = []
    for (const c of xml.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const at = atribut(c[1] ?? '')
      const alamat = /^([A-Z]+)(\d+)$/.exec(at.r ?? '')
      const isi = c[2]
      if (!alamat || !isi) continue
      const v = /<v>([\s\S]*?)<\/v>/.exec(isi)?.[1]
      let nilai: string | undefined
      if (at.t === 's') nilai = v === undefined ? undefined : sst[Number(v)]
      else if (at.t === 'inlineStr') nilai = gabungTeks(isi)
      else if (at.t === 'str') nilai = v === undefined ? undefined : dekode(v)
      else if (at.t === 'b') nilai = v === '1' ? 'TRUE' : 'FALSE'
      else if (at.t !== 'e') nilai = v
      if (nilai === undefined) continue
      const nomorBaris = Number(alamat[2]) - 1
      const baris = lembar[nomorBaris] ?? []
      lembar[nomorBaris] = baris
      baris[indeksKolom(alamat[1] as string)] = nilai
    }
    hasil[a.name] = lembar
  }
  return hasil
}
