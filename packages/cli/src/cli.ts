import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import {
  type Bahasa,
  type BatchReturFakturMasukan,
  fakturKeluaran,
  type HasilValidasi,
  type OpsiValidasi,
  returMasukan,
} from 'coretax-xml'
import pkg from '../package.json' with { type: 'json' }
import {
  dariCsv,
  dariExcel,
  FormatBerkasError,
  type HasilBaca,
  type Sumber,
  templateCsv,
} from './baca-faktur.js'
import { adalahCsvRetur, dariCsvRetur, dariExcelRetur, templateCsvRetur } from './baca-retur.js'
import { formatLaporan, type Laporan } from './laporan.js'
import { bacaXlsx } from './xlsx.js'

export interface IO {
  stdout: (s: string) => void
  stderr: (s: string) => void
}

const BANTUAN = `coretax-xml: ubah Excel/CSV menjadi XML impor Coretax DJP, dan periksa XML sebelum diunggah.
Bukan produk DJP dan bukan nasihat pajak. Berjalan lokal, tanpa internet.

Pemakaian:
  coretax-xml convert <file.xlsx|file.csv> [-o hasil.xml] [--hitung strict|otomatis] [--format teks|json|html]
                      [--maks-per-file N]   pecah faktur/retur menjadi beberapa file @ N faktur (hasil-0001.xml, ...)
      .xlsx = template Excel DJP: faktur pajak keluaran (sheet Faktur + DetailFaktur) atau retur faktur pajak
              masukan (sheet Retur + DetailRetur), dikenali otomatis; angka dibaca dari file
              (default --hitung strict: dicocokkan dengan hitungan library)
      .csv  = format sederhana, satu baris per item; faktur keluaran atau retur masukan (kolom no_retur), dikenali
              dari judul kolom (default --hitung otomatis; lihat perintah template)
  coretax-xml check <file.xml|folder> [--format teks|json|html] [-o laporan.html]
      memeriksa XML faktur pajak keluaran atau retur faktur pajak masukan yang sudah ada (dikenali dari elemen akar)
  coretax-xml template faktur-keluaran|retur-masukan [-o contoh.csv]
      mencetak contoh CSV dengan kolom yang benar
  coretax-xml schemas
      daftar versi skema

Opsi umum:
  --schema <id>     versi skema, mis. 2025.09 (default auto: dari tanggal faktur)
  --bahasa id|en    bahasa pesan (default id)
  -h, --help        bantuan        -v, --version   versi

Kode keluar: 0 lolos, 1 ada error pada data, 2 salah pemakaian atau file tidak dikenal.
`

const PENAFIAN =
  'Catatan: XML yang lolos pemeriksaan belum tentu diterima Coretax. Kebenaran kode transaksi, tarif, dan isi faktur tetap tanggung jawab Anda.\n'

class SalahPakai extends Error {}

type Dibaca =
  | ({ dokumen: 'faktur-keluaran' } & HasilBaca)
  | { dokumen: 'retur-masukan'; batch: BatchReturFakturMasukan; sumber: Sumber }

function bacaBerkas(
  berkas: string,
  hitung: 'strict' | 'otomatis' | undefined,
): Dibaca & { hitung: 'strict' | 'otomatis' } {
  const ext = extname(berkas).toLowerCase()
  if (ext !== '.xlsx' && ext !== '.csv') {
    throw new SalahPakai(
      `Jenis file "${ext || berkas}" tidak didukung. Gunakan .xlsx (template DJP) atau .csv.`,
    )
  }
  let data: Buffer
  try {
    data = readFileSync(berkas)
  } catch {
    throw new SalahPakai(`File tidak ditemukan atau tidak bisa dibaca: ${berkas}`)
  }
  try {
    if (ext === '.xlsx') {
      const h = hitung ?? 'strict'
      const sheets = bacaXlsx(new Uint8Array(data))
      if (sheets.Retur && sheets.DetailRetur) {
        return { dokumen: 'retur-masukan', ...dariExcelRetur(sheets, { hitung: h }), hitung: h }
      }
      return { dokumen: 'faktur-keluaran', ...dariExcel(sheets, { hitung: h }), hitung: h }
    }
    const h = hitung ?? 'otomatis'
    const teksCsv = data.toString('utf8')
    if (adalahCsvRetur(teksCsv)) {
      return { dokumen: 'retur-masukan', ...dariCsvRetur(teksCsv, { hitung: h }), hitung: h }
    }
    return { dokumen: 'faktur-keluaran', ...dariCsv(teksCsv, { hitung: h }), hitung: h }
  } catch (e) {
    if (e instanceof FormatBerkasError || e instanceof Error) throw new SalahPakai(`${berkas}: ${e.message}`)
    throw e
  }
}

function kumpulkanXml(target: string): string[] {
  let st: ReturnType<typeof statSync>
  try {
    st = statSync(target)
  } catch {
    throw new SalahPakai(`Tidak ditemukan: ${target}`)
  }
  if (!st.isDirectory()) return [target]
  const daftar = (readdirSync(target, { recursive: true }) as string[])
    .filter((f) => f.toLowerCase().endsWith('.xml'))
    .sort()
    .map((f) => join(target, f))
  if (daftar.length === 0) throw new SalahPakai(`Tidak ada file .xml di folder ${target}`)
  return daftar
}

export async function jalankan(
  argv: string[],
  io: IO = { stdout: (s) => process.stdout.write(s), stderr: (s) => process.stderr.write(s) },
): Promise<number> {
  try {
    const { values: v, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        output: { type: 'string', short: 'o' },
        format: { type: 'string', short: 'f', default: 'teks' },
        hitung: { type: 'string' },
        'maks-per-file': { type: 'string' },
        schema: { type: 'string' },
        bahasa: { type: 'string', default: 'id' },
        help: { type: 'boolean', short: 'h' },
        version: { type: 'boolean', short: 'v' },
      },
    })
    const [perintah, ...sisa] = positionals
    if (v.version) {
      io.stdout(`${pkg.version}\n`)
      return 0
    }
    if (v.help || perintah === 'help') {
      io.stdout(BANTUAN)
      return 0
    }
    if (!perintah) throw new SalahPakai('Perintah belum diberikan.')

    const format = v.format as 'teks' | 'json' | 'html'
    if (!['teks', 'json', 'html'].includes(format))
      throw new SalahPakai(`--format harus teks, json, atau html (bukan "${v.format}").`)
    if (v.hitung !== undefined && v.hitung !== 'strict' && v.hitung !== 'otomatis')
      throw new SalahPakai('--hitung harus strict atau otomatis.')
    if (v.bahasa !== 'id' && v.bahasa !== 'en') throw new SalahPakai('--bahasa harus id atau en.')
    const dasar: OpsiValidasi = { bahasa: v.bahasa as Bahasa, ...(v.schema ? { schema: v.schema } : {}) }

    if (perintah === 'schemas') {
      for (const s of [...fakturKeluaran.schemas(), ...returMasukan.schemas()]) {
        io.stdout(
          `${s.dokumen}@${s.id}  berlaku mulai ${s.berlakuMulai}\n  template: ${s.template}\n  converter: ${s.converter}\n  ${s.terverifikasiDenganXsdResmi ? 'diverifikasi dengan XSD resmi' : 'belum diverifikasi dengan XSD resmi (DJP tidak menerbitkan XSD)'}\n`,
        )
      }
      return 0
    }

    if (perintah === 'template') {
      const templat = { 'faktur-keluaran': templateCsv, 'retur-masukan': templateCsvRetur }[sisa[0] ?? '']
      if (!templat) throw new SalahPakai('Jenis template yang tersedia: faktur-keluaran, retur-masukan')
      if (v.output) writeFileSync(v.output, templat())
      else io.stdout(templat())
      return 0
    }

    if (perintah === 'convert') {
      const berkas = sisa[0]
      if (!berkas) throw new SalahPakai('convert butuh nama file .xlsx atau .csv.')
      const dibaca = bacaBerkas(berkas, v.hitung as 'strict' | 'otomatis' | undefined)
      const { sumber, hitung } = dibaca
      const opsi: OpsiValidasi = { ...dasar, hitung }
      const hasil: HasilValidasi =
        dibaca.dokumen === 'retur-masukan'
          ? returMasukan.validate(dibaca.batch, opsi)
          : fakturKeluaran.validate(dibaca.batch, opsi)
      const laporan: Laporan = { berkas, hasil, sumber }
      if (hasil.valid) {
        const dasarKeluaran = (
          v.output ?? `${berkas.slice(0, berkas.length - extname(berkas).length)}.xml`
        ).replace(/\.xml$/i, '')
        const maks = v['maks-per-file'] === undefined ? undefined : Number(v['maks-per-file'])
        if (maks !== undefined && (!Number.isInteger(maks) || maks < 1)) {
          throw new SalahPakai('--maks-per-file harus bilangan bulat >= 1.')
        }
        const tunggal =
          dibaca.dokumen === 'retur-masukan' ? dibaca.batch.retur.length : dibaca.batch.faktur.length
        if (maks === undefined || tunggal <= maks) {
          laporan.keluaran = [`${dasarKeluaran}.xml`]
          writeFileSync(
            laporan.keluaran[0] as string,
            dibaca.dokumen === 'retur-masukan'
              ? returMasukan.build(dibaca.batch, opsi)
              : fakturKeluaran.build(dibaca.batch, opsi),
          )
        } else {
          // Terlalu banyak untuk satu file: pecah menjadi <nama>-0001.xml, <nama>-0002.xml, ...
          laporan.keluaran = []
          const o = { ...opsi, maksPerFile: maks, awalanNama: dasarKeluaran }
          for await (const b of dibaca.dokumen === 'retur-masukan'
            ? returMasukan.buildStream({ pembeli: dibaca.batch.pembeli, retur: dibaca.batch.retur }, o)
            : fakturKeluaran.buildStream({ penjual: dibaca.batch.penjual, faktur: dibaca.batch.faktur }, o)) {
            writeFileSync(b.nama, b.isi)
            laporan.keluaran.push(b.nama)
          }
        }
      }
      io.stdout(formatLaporan(format, [laporan]))
      if (hasil.valid && format === 'teks') io.stdout(PENAFIAN)
      return hasil.valid ? 0 : 1
    }

    if (perintah === 'check') {
      if (!sisa[0]) throw new SalahPakai('check butuh nama file .xml atau folder.')
      const daftar: Laporan[] = kumpulkanXml(sisa[0]).map((f) => {
        const xml = readFileSync(f, 'utf8')
        const retur = /<InputTaxInvoiceReturn[\s>/]/.test(xml.slice(0, 4000))
        return { berkas: f, hasil: retur ? returMasukan.check(xml, dasar) : fakturKeluaran.check(xml, dasar) }
      })
      const teks = formatLaporan(format, daftar)
      if (v.output) writeFileSync(v.output, teks)
      else io.stdout(teks)
      return daftar.every((l) => l.hasil.valid) ? 0 : 1
    }

    throw new SalahPakai(`Perintah tidak dikenal: ${perintah}`)
  } catch (e) {
    if (
      e instanceof SalahPakai ||
      (e instanceof Error && 'code' in e && String(e.code).startsWith('ERR_PARSE_ARGS'))
    ) {
      io.stderr(`${(e as Error).message}\n\nBantuan: coretax-xml --help\n`)
      return 2
    }
    throw e
  }
}
