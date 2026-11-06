import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type BatchReturFakturMasukan, returMasukan } from '../src/index.js'

const path = (nama: string) =>
  fileURLToPath(new URL(`../../../fixtures/retur-masukan/golden/${nama}`, import.meta.url))
const kasus = JSON.parse(readFileSync(path('kasus.json'), 'utf8')) as BatchReturFakturMasukan
const adaGolden = existsSync(path('kasus.converter.xml'))

// Buang BOM, indentasi, header XML, dan atribut pada elemen akar; elemen kosong disamakan menjadi <X/>.
const normal = (xml: string) => {
  const s = xml.replace(/^﻿/, '')
  return s
    .slice(s.indexOf('<TIN>'))
    .replace(/>\s+</g, '><')
    .replace(/<(\w+)(?:\s[^>]*)?\s*\/>/g, '<$1/>')
    .trim()
}

describe('golden file retur faktur masukan', () => {
  it('kasus.json konsisten dengan hitungan library: tanpa error dan tanpa peringatan', () => {
    const h = returMasukan.validate(kasus)
    expect(h.errors).toEqual([])
    expect(h.warnings).toEqual([])
    expect(kasus.retur).toHaveLength(3)
  })

  it('hasil build lolos check()', () => {
    expect(returMasukan.check(returMasukan.build(kasus)).valid).toBe(true)
  })

  it.skipIf(!adaGolden)('build() sama dengan XML dari converter resmi DJP', () => {
    const resmi = readFileSync(path('kasus.converter.xml'), 'utf8')
    expect(normal(returMasukan.build(kasus))).toBe(normal(resmi))
  })

  it.skipIf(!adaGolden)('check() meloloskan XML dari converter resmi DJP', () => {
    const h = returMasukan.check(readFileSync(path('kasus.converter.xml'), 'utf8'))
    expect(h.errors).toEqual([])
  })
})
