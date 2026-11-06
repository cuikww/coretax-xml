import type { FakturTerhitung, ItemTerhitung } from './faktur-keluaran.js'
import { formatXml } from './money.js'
import { elemenFaktur, elemenItem } from './schemas/faktur-keluaran/v2025-09.js'

const ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

export function escapeXml(teks: string): string {
  // Buang karakter kontrol yang tidak sah di XML 1.0 (selain tab, LF, CR), lalu escape
  let bersih = ''
  for (const c of teks) {
    const kode = c.charCodeAt(0)
    if (kode >= 0x20 || kode === 0x09 || kode === 0x0a || kode === 0x0d) bersih += c
  }
  return bersih.replace(/[&<>]/g, (c) => ESCAPE[c] ?? c)
}

function elemen(indent: string, nama: string, nilai: string): string {
  return nilai === '' ? `${indent}<${nama}/>` : `${indent}<${nama}>${escapeXml(nilai)}</${nama}>`
}

function nilaiItem(it: ItemTerhitung, nama: (typeof elemenItem)[number]): string {
  const v = it[nama]
  return typeof v === 'bigint' ? formatXml(v) : v
}

/** Tulis XML faktur pajak keluaran. Urutan elemen mengikuti skema; indentasi 2 spasi, akhir baris LF. */
export function tulisXml(tin: string, faktur: FakturTerhitung[]): string {
  const baris: string[] = [
    '<?xml version="1.0" encoding="utf-8" ?>',
    '<TaxInvoiceBulk xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="TaxInvoice.xsd">',
    elemen('  ', 'TIN', tin),
    '  <ListOfTaxInvoice>',
  ]
  for (const f of faktur) {
    baris.push('    <TaxInvoice>')
    for (const nama of elemenFaktur) baris.push(elemen('      ', nama, f.header[nama] ?? ''))
    baris.push('      <ListOfGoodService>')
    for (const it of f.item) {
      baris.push('        <GoodService>')
      for (const nama of elemenItem) baris.push(elemen('          ', nama, nilaiItem(it, nama)))
      baris.push('        </GoodService>')
    }
    baris.push('      </ListOfGoodService>')
    baris.push('    </TaxInvoice>')
  }
  baris.push('  </ListOfTaxInvoice>', '</TaxInvoiceBulk>', '')
  return baris.join('\n')
}
