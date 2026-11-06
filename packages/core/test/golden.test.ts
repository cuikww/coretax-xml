import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type BatchFakturKeluaran, fakturKeluaran } from '../src/index.js'

const path = (nama: string) =>
  fileURLToPath(new URL(`../../../fixtures/faktur-keluaran/golden/${nama}`, import.meta.url))
const kasus = JSON.parse(readFileSync(path('kasus.json'), 'utf8')) as BatchFakturKeluaran
const adaGolden = existsSync(path('kasus.converter.xml'))

// Buang indentasi dan samakan penulisan elemen kosong (<X/>, <X />, <X xsi:nil="true" />);
// header <?xml ...?> dan atribut root tidak dibandingkan, hanya isi dari <TIN>.
const normal = (xml: string) =>
  xml
    .slice(xml.indexOf('<TIN>'))
    .replace(/>\s+</g, '><')
    .replace(/<(\w+)(?:\s[^>]*)?\s*\/>/g, '<$1/>')
    .trim()

describe('golden file Gerbang 1', () => {
  it('semua angka di kasus.json cocok dengan hitungan library (mode strict, tanpa error)', () => {
    const h = fakturKeluaran.validate(kasus, { hitung: 'strict' })
    expect(h.errors).toEqual([])
    expect(kasus.faktur).toHaveLength(10)
  })

  it.skipIf(!adaGolden)('build() sama dengan XML dari converter resmi DJP', () => {
    const resmi = readFileSync(path('kasus.converter.xml'), 'utf8')
    expect(normal(fakturKeluaran.build(kasus, { hitung: 'strict' }))).toBe(normal(resmi))
  })
})
