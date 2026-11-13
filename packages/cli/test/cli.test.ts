import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { bulat2, tanggalIso } from '../src/angka.js'
import { parseCsv } from '../src/csv.js'
import { bacaXlsx } from '../src/xlsx.js'
import {
  barisDetail,
  barisDetailRetur,
  barisFaktur,
  barisRetur,
  buatXlsx,
  cli,
  folderSementara,
  templateExcel,
  templateRetur,
  tulis,
} from './bantu.js'

const dariRepo = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url))

describe('angka', () => {
  it('bulat2 setengah ke genap seperti converter DJP (hasil probe-pembulatan)', () => {
    const hasil = ['0.005', '0.015', '0.025', '0.035', '2.675', '100.125'].map(bulat2)
    expect(hasil).toEqual(['0.00', '0.02', '0.02', '0.04', '2.68', '100.12'])
  })
  it('bulat2 membiarkan angka 2 desimal, notasi ilmiah, dan teks yang bukan angka', () => {
    expect(bulat2('1500.5')).toBe('1500.5')
    expect(bulat2('504166.66666666669')).toBe('504166.67')
    expect(bulat2('1.5E-05')).toBe('0.00')
    expect(bulat2('1.000.000')).toBe('1.000.000')
    expect(bulat2(undefined)).toBeUndefined()
  })
  it('tanggalIso: nomor seri Excel, DD/MM/YYYY, ISO', () => {
    expect(tanggalIso('46296')).toBe('2026-10-01')
    expect(tanggalIso('05/10/2026')).toBe('2026-10-05')
    expect(tanggalIso('2026-10-01')).toBe('2026-10-01')
    expect(tanggalIso('kemarin')).toBe('kemarin')
  })
})

describe('parseCsv', () => {
  it('kutip, kutip di dalam kutip, baris baru di dalam kutip, pemisah titik koma, baris kosong tetap dihitung', () => {
    expect(parseCsv('a;b\n"x;1";"say ""hi"""\n\n"l1\nl2";z\n')).toEqual([
      ['a', 'b'],
      ['x;1', 'say "hi"'],
      [''],
      ['l1\nl2', 'z'],
    ])
  })
  it('kutip tidak ditutup', () => {
    expect(() => parseCsv('a,"b')).toThrow('kutip')
  })
})

describe('bacaXlsx', () => {
  it('string bersama, angka apa adanya, nilai rumus tersimpan, sel kosong dilewati', () => {
    const l = bacaXlsx(buatXlsx({ S: [['A & B', 12.5, { rumus: '1+1', hasil: 2 }], [], [undefined, 'x']] }))
    expect(l.S?.[0]).toEqual(['A & B', '12.5', '2'])
    expect(l.S?.[2]?.[1]).toBe('x')
  })
  it('bukan xlsx', () => {
    expect(() => bacaXlsx(new Uint8Array([1, 2, 3]))).toThrow('xlsx')
  })
})

describe('convert dari template Excel DJP', () => {
  it('menulis XML dan melaporkan LOLOS', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'jual.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1)]))
    const r = await cli('convert', f)
    expect(r.kode).toBe(0)
    expect(r.out).toContain('LOLOS')
    expect(r.out).toContain('Catatan: XML yang lolos pemeriksaan belum tentu diterima Coretax')
    const xml = readFileSync(f.replace('.xlsx', '.xml'), 'utf8')
    expect(xml).toContain('<TaxInvoiceDate>2026-10-01</TaxInvoiceDate>')
    expect(xml).toContain('<OtherTaxBase>1100000</OtherTaxBase>')
    expect(xml).toContain('<VAT>132000</VAT>')
  })

  it('opsi -o dan hasilnya lolos check', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'jual.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1)]))
    const keluar = `${dir}/hasil.xml`
    expect((await cli('convert', f, '-o', keluar)).kode).toBe(0)
    expect((await cli('check', keluar)).kode).toBe(0)
  })

  it('error menunjuk baris Excel di sheet asal', async () => {
    const dir = folderSementara()
    const f = tulis(
      dir,
      'salah.xlsx',
      templateExcel([barisFaktur(1), barisFaktur(2)], [barisDetail(1), barisDetail(2, [4, 'UM.9999'])]),
    )
    const r = await cli('convert', f)
    expect(r.kode).toBe(1)
    expect(r.out).toContain('DITOLAK')
    // Faktur 2 ada di baris Excel 5 (judul di baris 3, data mulai 4); item di baris 3 sheet DetailFaktur
    expect(r.out).toContain('Faktur ke-2 (baris Excel 5), item 1 (baris Excel 3) <Unit>')
    expect(existsSync(f.replace('.xlsx', '.xml'))).toBe(false)
  })

  it('angka yang tidak cocok dengan hitungan: strict menolak, otomatis menghitung ulang', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'beda.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1, [11, 131000])]))
    expect((await cli('convert', f)).out).toContain('VAT_MISMATCH')
    const r = await cli('convert', f, '--hitung', 'otomatis')
    expect(r.kode).toBe(0)
    expect(readFileSync(f.replace('.xlsx', '.xml'), 'utf8')).toContain('<VAT>132000</VAT>')
  })

  it('nilai Excel dibulatkan setengah ke genap seperti converter DJP', async () => {
    const dir = folderSementara()
    // Harga 0,025 -> 0,02 (ke genap); jumlah 1; DPP/NL/PPN/PPnBM diisi sama dengan hasil bulat
    const f = tulis(
      dir,
      'bulat.xlsx',
      templateExcel(
        [barisFaktur(1, [3, '01'])],
        [barisDetail(1, [5, 0.025], [6, 1], [8, 0.02], [9, 0.02], [11, 0], [13, 0])],
      ),
    )
    const r = await cli('convert', f, '--hitung', 'strict', '--format', 'json')
    const j = JSON.parse(r.out)
    expect(j[0].errors.map((e: { code: string }) => e.code)).toEqual([]) // 0,02 x 12% = 0,0024 -> 0
    expect(readFileSync(f.replace('.xlsx', '.xml'), 'utf8')).toContain('<Price>0.02</Price>')
  })

  it('format file salah: keluar kode 2 dengan pesan jelas', async () => {
    const dir = folderSementara()
    const tanpaDetail = tulis(dir, 'a.xlsx', buatXlsx({ Faktur: [['x']] }))
    const r1 = await cli('convert', tanpaDetail)
    expect(r1.kode).toBe(2)
    expect(r1.err).toContain('bukan template Excel faktur pajak keluaran DJP')

    const yatim = tulis(dir, 'b.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1), barisDetail(7)]))
    const r2 = await cli('convert', yatim)
    expect(r2.kode).toBe(2)
    expect(r2.err).toContain('DetailFaktur baris 3: nilai kolom Baris tidak ada di sheet Faktur')

    const dua = tulis(
      dir,
      'c.xlsx',
      templateExcel(
        [barisFaktur(1), barisFaktur(2, [9, `9${'0'.repeat(21)}`])],
        [barisDetail(1), barisDetail(2)],
      ),
    )
    expect((await cli('convert', dua)).err).toContain('ID TKU Penjual harus sama')

    expect((await cli('convert', `${dir}/tidak-ada.xlsx`)).kode).toBe(2)
    expect((await cli('convert', tulis(dir, 'd.txt', 'x'))).err).toContain('tidak didukung')
    expect((await cli('convert', tulis(dir, 'rusak.xlsx', 'bukan zip'))).err).toContain('xlsx')
  })

  it.skipIf(!existsSync(dariRepo('fixtures/djp/unduhan/kasus.xlsx')))(
    'kasus.xlsx asli (template DJP) menghasilkan XML yang sama dengan converter resmi',
    async () => {
      const dir = folderSementara()
      const f = tulis(dir, 'kasus.xlsx', readFileSync(dariRepo('fixtures/djp/unduhan/kasus.xlsx')))
      expect((await cli('convert', f)).kode).toBe(0)
      const normal = (x: string) =>
        x.replace(/^﻿/, '').slice(x.replace(/^﻿/, '').indexOf('<TIN>')).replace(/>\s+</g, '><').trim()
      const resmi = readFileSync(dariRepo('fixtures/faktur-keluaran/golden/kasus.converter.xml'), 'utf8')
      expect(normal(readFileSync(f.replace('.xlsx', '.xml'), 'utf8'))).toBe(normal(resmi))
    },
  )
})

describe('convert --maks-per-file', () => {
  it('memecah faktur keluaran menjadi beberapa file yang masing-masing lolos check', async () => {
    const dir = folderSementara()
    const faktur = [1, 2, 3, 4, 5].map((n) => barisFaktur(n))
    const detail = [1, 2, 3, 4, 5].map((n) => barisDetail(n))
    const f = tulis(dir, 'banyak.xlsx', templateExcel(faktur, detail))
    const r = await cli('convert', f, '--maks-per-file', '2')
    expect(r.kode).toBe(0)
    const nama = [1, 2, 3].map((n) => f.replace('.xlsx', `-000${n}.xml`))
    for (const n of nama) expect(r.out).toContain(`XML ditulis ke ${n}`)
    expect(existsSync(f.replace('.xlsx', '.xml'))).toBe(false)
    expect((readFileSync(nama[2] as string, 'utf8').match(/<TaxInvoice>/g) ?? []).length).toBe(1)
    expect((await cli('check', dir)).out).toContain('3 dari 3 berkas lolos.')
  })

  it('jumlah faktur tidak melebihi batas = satu file biasa; JSON memuat daftar file; nilai salah ditolak', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'kecil.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1)]))
    const j = JSON.parse((await cli('convert', f, '--maks-per-file', '10', '--format', 'json')).out)
    expect(j[0].keluaran).toEqual([f.replace('.xlsx', '.xml')])
    expect((await cli('convert', f, '--maks-per-file', '0')).err).toContain('bilangan bulat')
  })

  it('retur masukan ikut dipecah; tiap file lolos check', async () => {
    const dir = folderSementara()
    const f = tulis(
      dir,
      'r.xlsx',
      templateRetur(
        [1, 2, 3].map((n) => barisRetur(n)),
        [1, 2, 3].map((n) => barisDetailRetur(n)),
      ),
    )
    const r = await cli('convert', f, '--maks-per-file', '2')
    expect(r.kode).toBe(0)
    expect(existsSync(f.replace('.xlsx', '-0002.xml'))).toBe(true)
    expect((await cli('check', dir)).out).toContain('2 dari 2 berkas lolos.')
  })
})

describe('convert retur faktur masukan dari template Excel DJP', () => {
  it('dikenali dari sheet Retur + DetailRetur; XML sama dengan sampel resmi DJP (selain indentasi)', async () => {
    const dir = folderSementara()
    const f = tulis(
      dir,
      'retur.xlsx',
      templateRetur([barisRetur(1)], [barisDetailRetur(1), barisDetailRetur(1)]),
    )
    const r = await cli('convert', f)
    expect(r.kode).toBe(0)
    expect(r.out).toContain('skema retur-masukan@2025.03')
    const normal = (x: string) =>
      x
        .replace(/^\ufeff/, '')
        .replace(/>\s+</g, '><')
        .trim()
    const resmi = readFileSync(dariRepo('fixtures/djp/Sample Retur Faktur PM Template v.1.1.xml'), 'utf8')
    // Sampel resmi memuat 2 baris dan total 20000; padankan datanya
    const dua = tulis(
      dir,
      'dua.xlsx',
      templateRetur(
        [barisRetur(1, [4, 20000], [5, 20000], [6, 2200])],
        [barisDetailRetur(1, [4, 1]), barisDetailRetur(1, [4, 1])],
      ),
    )
    expect((await cli('convert', dua)).kode).toBe(0)
    expect(normal(readFileSync(dua.replace('.xlsx', '.xml'), 'utf8'))).toBe(normal(resmi))
    expect((await cli('check', dua.replace('.xlsx', '.xml'))).kode).toBe(0)
  })

  it('error menunjuk baris Excel dan memakai istilah Retur', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'salah.xlsx', templateRetur([barisRetur(1)], [barisDetailRetur(1, [7, 25])]))
    const r = await cli('convert', f)
    expect(r.kode).toBe(1)
    expect(r.out).toContain('Retur ke-1 (baris Excel 4), item 1 (baris Excel 2) <ReturnQuantity>')
    expect(r.out).toContain('RETUR_QTY_EXCEEDS')
  })

  it('--hitung otomatis menghitung ulang DPP dan total dokumen; PPN tetap harus diisi', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'beda.xlsx', templateRetur([barisRetur(1, [4, 999])], [barisDetailRetur(1)]))
    const strict = await cli('convert', f)
    expect(strict.kode).toBe(0)
    expect(strict.out).toContain('RETUR_TOTAL_MISMATCH') // hanya peringatan
    const o = await cli('convert', f, '--hitung', 'otomatis')
    expect(o.kode).toBe(0)
    expect(o.out).not.toContain('RETUR_TOTAL_MISMATCH')
    expect(readFileSync(f.replace('.xlsx', '.xml'), 'utf8')).toContain('<ReturnTaxBase>10000</ReturnTaxBase>')
  })

  it('baris detail tanpa retur = kode 2; check mengenali retur dan faktur dalam satu folder', async () => {
    const dir = folderSementara()
    const yatim = tulis(
      dir,
      'y.xlsx',
      templateRetur([barisRetur(1)], [barisDetailRetur(1), barisDetailRetur(5)]),
    )
    const r = await cli('convert', yatim)
    expect(r.kode).toBe(2)
    expect(r.err).toContain('DetailRetur baris 3: nilai kolom Baris tidak ada di sheet Retur')

    const campur = folderSementara()
    const a = tulis(campur, 'a.xlsx', templateRetur([barisRetur(1)], [barisDetailRetur(1)]))
    const b = tulis(campur, 'b.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1)]))
    await cli('convert', a)
    await cli('convert', b)
    const j = JSON.parse((await cli('check', campur, '--format', 'json')).out) as {
      schema: string
      valid: boolean
    }[]
    expect(j.map((x) => [x.schema, x.valid])).toEqual([
      ['retur-masukan@2025.03', true],
      ['faktur-keluaran@2025.09', true],
    ])
    expect((await cli('schemas')).out).toContain('retur-masukan@2025.03')
  })
})

describe('CSV retur faktur masukan', () => {
  const sampel = () =>
    readFileSync(dariRepo('fixtures/djp/Sample Retur Faktur PM Template v.1.1.xml'), 'utf8')
  const normal = (x: string) =>
    x
      .replace(/^\ufeff/, '')
      .replace(/>\s+</g, '><')
      .trim()

  it('template retur-masukan -> convert menghasilkan XML yang sama dengan sampel resmi DJP', async () => {
    const dir = folderSementara()
    const t = await cli('template', 'retur-masukan')
    expect(t.kode).toBe(0)
    const [judul, contoh] = t.out.replaceAll('0000000000000000', '1091031210912281').trim().split('\n') as [
      string,
      string,
    ]
    const f = tulis(dir, 'retur.csv', `${judul}\n${contoh}\n${contoh}\n`)
    const r = await cli('convert', f)
    expect(r.kode).toBe(0)
    expect(r.out).toContain('skema retur-masukan@2025.03')
    expect(normal(readFileSync(f.replace('.csv', '.xml'), 'utf8'))).toBe(normal(sampel()))
  })

  it('error menunjuk baris CSV; kolom wajib hilang dan pelapor berbeda = kode 2', async () => {
    const dir = folderSementara()
    const [judul, contoh] = (await cli('template', 'retur-masukan')).out.trim().split('\n') as [
      string,
      string,
    ]
    const salah = tulis(dir, 'salah.csv', `${judul}\n${contoh.replace(',10000,,1,', ',10000,,5,')}\n`)
    const r = await cli('convert', salah)
    expect(r.kode).toBe(1)
    expect(r.out).toContain('Retur ke-1 (baris CSV 2), item 1 (baris CSV 2) <ReturnQuantity>')
    const tanpaKolom = tulis(dir, 'k.csv', 'no_retur,nomor_faktur\nA,1\n')
    expect((await cli('convert', tanpaKolom)).err).toContain('Kolom wajib tidak ada di CSV retur')
    const beda = tulis(
      dir,
      'b.csv',
      `${judul}\n${contoh}\n${contoh.replace(/,0000000000000000$/, ',1111222233334444')}\n`,
    )
    const rb = await cli('convert', beda)
    expect(rb.kode).toBe(2)
    expect(rb.err).toContain('npwp_pembeli harus sama di semua baris')
    expect((await cli('template', 'bupot')).err).toContain('faktur-keluaran, retur-masukan')
  })

  it('--hitung strict membaca total dokumen dan DPP dari CSV; total rupiah utuh tidak dianggap selisih', async () => {
    const dir = folderSementara()
    const csv = [
      'no_retur,nomor_faktur,npwp_penjual,tanggal,dpp_total,ppn_total,jenis_item,nama_barang,satuan,jumlah_faktur,harga,jumlah_retur,dpp,ppn,npwp_pembeli',
      'A,04002500000348920,0000000000000000,27/02/2025,36251,4350,barang,Gula,UM.0003,10.5,14500.5,2.5,36251.25,4350.15,0000000000000000',
    ].join('\n')
    const f = tulis(dir, 'strict.csv', csv)
    const r = await cli('convert', f, '--hitung', 'strict', '--format', 'json')
    const j = JSON.parse(r.out)
    expect(j[0].warnings).toEqual([])
    expect(j[0].valid).toBe(true)
    const xml = readFileSync(f.replace('.csv', '.xml'), 'utf8')
    expect(xml).toContain('<ReturnTaxBase>36251</ReturnTaxBase>')
    expect(xml).toContain('<ReturnTaxBase>36251.25</ReturnTaxBase>')
  })
})

describe('convert dari CSV', () => {
  it('template -> convert: lolos, hitung otomatis, 2 baris satu faktur menjadi 2 item', async () => {
    const dir = folderSementara()
    const t = await cli('template', 'faktur-keluaran')
    expect(t.kode).toBe(0)
    const [judul, contoh] = t.out.trim().split('\n') as [string, string]
    const f = tulis(
      dir,
      'jual.csv',
      `${judul}\n${contoh}\n${contoh.replace('Jasa Konsultasi', 'Jasa Lain')}\n`,
    )
    const r = await cli('convert', f)
    expect(r.kode).toBe(0)
    const xml = readFileSync(f.replace('.csv', '.xml'), 'utf8')
    expect(xml.match(/<TaxInvoice>/g)).toHaveLength(1)
    expect(xml.match(/<GoodService>/g)).toHaveLength(2)
    expect(xml).toContain('<OtherTaxBase>1100000</OtherTaxBase>')
  })

  it('error menunjuk baris CSV; kolom wajib hilang = kode 2', async () => {
    const dir = folderSementara()
    const t = (await cli('template', 'faktur-keluaran')).out.trim().split('\n') as [string, string]
    const f = tulis(dir, 'salah.csv', `${t[0]}\n${t[1].replace('UM.0033', 'UM.9999')}\n`)
    const r = await cli('convert', f)
    expect(r.kode).toBe(1)
    expect(r.out).toContain('Faktur ke-1 (baris CSV 2), item 1 (baris CSV 2) <Unit>')
    const r2 = await cli('convert', tulis(dir, 'k.csv', 'a,b\n1,2\n'))
    expect(r2.kode).toBe(2)
    expect(r2.err).toContain('Kolom wajib tidak ada di CSV')
  })
})

describe('check', () => {
  const xmlBagus = async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'jual.xlsx', templateExcel([barisFaktur(1)], [barisDetail(1)]))
    await cli('convert', f)
    return { dir, xml: f.replace('.xlsx', '.xml') }
  }

  it('satu file, folder, dan format json/html', async () => {
    const { dir, xml } = await xmlBagus()
    tulis(dir, 'rusak.xml', '<a><b></a>')
    const satu = await cli('check', xml)
    expect(satu.kode).toBe(0)
    const folder = await cli('check', dir)
    expect(folder.kode).toBe(1)
    expect(folder.out).toContain('1 dari 2 berkas lolos.')
    const j = JSON.parse((await cli('check', dir, '--format', 'json')).out)
    expect(j.map((x: { valid: boolean }) => x.valid)).toEqual([true, false])
    const html = (await cli('check', dir, '--format', 'html')).out
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('XML_PARSE')
  })

  it('-o menulis laporan ke file, bukan ke layar', async () => {
    const { dir, xml } = await xmlBagus()
    const laporan = `${dir}/laporan.html`
    const r = await cli('check', xml, '--format', 'html', '-o', laporan)
    expect(r.out).toBe('')
    expect(readFileSync(laporan, 'utf8')).toContain('LOLOS')
  })

  it('pesan bahasa Inggris dan folder tanpa xml', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'x.xml', '<Lain/>')
    expect((await cli('check', f, '--bahasa', 'en')).out).toContain('Root element must be <TaxInvoiceBulk>')
    const kosong = folderSementara()
    expect((await cli('check', kosong)).kode).toBe(2)
  })
})

describe('umum', () => {
  it('bantuan, versi, schemas, dan salah pakai', async () => {
    expect((await cli('--help')).out).toContain('Pemakaian:')
    expect((await cli('--version')).out).toMatch(/^\d+\.\d+\.\d+\n$/)
    expect((await cli('schemas')).out).toContain('faktur-keluaran@2025.09')
    expect((await cli()).kode).toBe(2)
    expect((await cli('hapus')).err).toContain('Perintah tidak dikenal')
    expect((await cli('check', 'x', '--format', 'pdf')).err).toContain('--format harus')
    expect((await cli('check', 'x', '--tidak-ada')).kode).toBe(2)
    expect((await cli('template', 'bupot')).kode).toBe(2)
  })
})

describe('retur: perbandingan dengan converter DJP', () => {
  it.skipIf(
    !existsSync(dariRepo('fixtures/djp/unduhan/retur.xlsx')) ||
      !existsSync(dariRepo('fixtures/retur-masukan/golden/kasus.converter.xml')),
  )('retur.xlsx asli (template DJP) menghasilkan XML yang sama dengan converter resmi', async () => {
    const dir = folderSementara()
    const f = tulis(dir, 'retur.xlsx', readFileSync(dariRepo('fixtures/djp/unduhan/retur.xlsx')))
    expect((await cli('convert', f)).kode).toBe(0)
    const normal = (x: string) => {
      const s = x.replace(/^﻿/, '')
      return s.slice(s.indexOf('<TIN>')).replace(/>\s+</g, '><').trim()
    }
    const resmi = readFileSync(dariRepo('fixtures/retur-masukan/golden/kasus.converter.xml'), 'utf8')
    expect(normal(readFileSync(f.replace('.xlsx', '.xml'), 'utf8'))).toBe(normal(resmi))
  })
})
