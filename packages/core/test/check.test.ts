import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type BatchFakturKeluaran, fakturKeluaran } from '../src/index.js'
import { parseXml } from '../src/xml-baca.js'

const fixture = (p: string) =>
  readFileSync(fileURLToPath(new URL(`../../../fixtures/${p}`, import.meta.url)), 'utf8')
const kasus = JSON.parse(fixture('faktur-keluaran/golden/kasus.json')) as BatchFakturKeluaran
const xmlKasus = fakturKeluaran.build(kasus, { hitung: 'strict' })
const kode = (xml: string, opsi = {}) => fakturKeluaran.check(xml, opsi).errors.map((e) => e.code)

describe('check: file nyata', () => {
  it('XML buatan library lolos', () => {
    expect(fakturKeluaran.check(xmlKasus)).toMatchObject({ valid: true, errors: [] })
  })

  it('output converter resmi DJP (BOM, CRLF, root berbeda) lolos', () => {
    const h = fakturKeluaran.check(fixture('faktur-keluaran/golden/kasus.converter.xml'))
    expect(h.errors).toEqual([])
    expect(h.valid).toBe(true)
  })

  it('sampel resmi DJP v1.4: nama dan alamat pembeli kosong ditolak, negara IND diperingatkan', () => {
    const h = fakturKeluaran.check(fixture('djp/Sample Faktur PK Template v.1.4.xml'))
    expect(h.errors.map((e) => [e.code, e.element, e.faktur])).toEqual([
      ['REQUIRED', 'BuyerName', 1],
      ['REQUIRED', 'BuyerAdress', 1],
    ])
    expect(h.warnings.map((w) => w.code)).toEqual(['COUNTRY_IND'])
  })

  it('file retur resmi bukan faktur keluaran: XML_ROOT', () => {
    const h = fakturKeluaran.check(fixture('djp/Sample Retur Faktur PM Template v.1.1.xml'))
    expect(h.errors.map((e) => e.code)).toEqual(['XML_ROOT'])
    expect(h.errors[0]?.pesan).toBe('Elemen akar harus <TaxInvoiceBulk>, ditemukan <InputTaxInvoiceReturn>.')
  })
})

describe('check: kerusakan', () => {
  it('XML rusak', () => {
    expect(kode('<a><b></a>')).toEqual(['XML_PARSE'])
    expect(kode('')).toEqual(['XML_PARSE'])
    expect(kode('<a>')).toEqual(['XML_PARSE'])
    expect(kode('teks biasa')).toEqual(['XML_PARSE'])
  })

  it('elemen hilang dilaporkan bersama akibatnya', () => {
    const h = fakturKeluaran.check(xmlKasus.replace(/ *<BuyerName>[^<]*<\/BuyerName>\n/, ''))
    expect(h.errors.map((e) => [e.code, e.element, e.faktur])).toEqual([
      ['XML_ELEMENT_MISSING', 'BuyerName', 1],
      ['REQUIRED', 'BuyerName', 1],
    ])
  })

  it('elemen asing dan urutan salah', () => {
    expect(kode(xmlKasus.replace('<TIN>', '<Lain>x</Lain><TIN>'))).toEqual(['XML_ELEMENT_UNKNOWN'])
    const tertukar = xmlKasus.replace(
      /(<TaxInvoiceDate>[^<]*<\/TaxInvoiceDate>)(\s*)(<TaxInvoiceOpt>[^<]*<\/TaxInvoiceOpt>)/,
      '$3$2$1',
    )
    const h = fakturKeluaran.check(tertukar)
    expect(h.errors.map((e) => e.code)).toEqual(['XML_ELEMENT_ORDER'])
    expect(h.errors[0]?.saran).toContain('TaxInvoiceDate, TaxInvoiceOpt, TrxCode')
  })

  it('angka yang tidak cocok dengan hitungan ditolak (faktur ke-2 kode 04)', () => {
    const rusak = xmlKasus.replace('<VAT>132000</VAT>', '<VAT>131000</VAT>')
    const h = fakturKeluaran.check(rusak)
    expect(h.errors.map((e) => [e.code, e.faktur, e.item])).toEqual([['VAT_MISMATCH', 2, 1]])
    expect(h.errors[0]?.pesan).toBe('PPN 131.000 tidak sama dengan 12% x DPP nilai lain 1.100.000 = 132.000.')
  })

  it('SellerIDTKU berbeda antar faktur', () => {
    const lama = `<SellerIDTKU>${'0'.repeat(22)}</SellerIDTKU>`
    const i = xmlKasus.lastIndexOf(lama) // faktur terakhir
    const rusak = `${xmlKasus.slice(0, i)}<SellerIDTKU>1234567890123456789012</SellerIDTKU>${xmlKasus.slice(i + lama.length)}`
    const h = fakturKeluaran.check(rusak)
    expect(h.errors.map((e) => [e.code, e.faktur])).toEqual([['XML_SELLER_MISMATCH', 10]])
  })

  it('pesan bahasa Inggris', () => {
    const h = fakturKeluaran.check('<Lain/>', { bahasa: 'en' })
    expect(h.errors[0]?.pesan).toBe('Root element must be <TaxInvoiceBulk>, found <Lain>.')
  })
})

describe('parseXml', () => {
  it('entitas, CDATA, komentar, atribut, elemen kosong', () => {
    const akar = parseXml(
      '﻿<?xml version="1.0"?>\n<a x="1"><!-- c --><b>A &amp; B &#65;&#x42; &lt;</b><c><![CDATA[<raw>&]]></c><d xsi:nil="true"/><e/></a>',
    )
    expect(akar.anak.map((n) => [n.nama, n.teks])).toEqual([
      ['b', 'A & B AB <'],
      ['c', '<raw>&'],
      ['d', ''],
      ['e', ''],
    ])
  })

  it('karakter khusus di nama pembeli bolak-balik (build lalu check)', () => {
    // kasus.json faktur ke-3 memuat & < > " di nama dan alamat
    expect(fakturKeluaran.check(xmlKasus).valid).toBe(true)
    expect(xmlKasus).toContain('CV Kopi &amp; Teh "Jaya"')
  })
})
