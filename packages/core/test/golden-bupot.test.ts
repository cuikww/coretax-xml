import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { type BatchBupot21, type BatchBupot26, bupot21, bupot26 } from '../src/index.js'

const path = (f: string) => fileURLToPath(new URL(`../../../fixtures/bupot/golden/${f}`, import.meta.url))
const json = <T>(f: string) => JSON.parse(readFileSync(path(f), 'utf8')) as T
// Ekspor Excel memakai CRLF; selain itu dibandingkan apa adanya
const normal = (x: string) => x.replace(/^﻿/, '').replace(/\r\n/g, '\n').trim()

for (const [nama, api, berkas] of [
  ['BP21', bupot21, 'bp21'],
  ['BP26', bupot26, 'bp26'],
] as const) {
  const kasus = json<BatchBupot21 & BatchBupot26>(`kasus-${berkas}.json`)
  const excel = `kasus-${berkas}.excel.xml`
  const ada = existsSync(path(excel))

  describe(`golden file ${nama} (ekspor XML dari Excel)`, () => {
    it(`kasus-${berkas}.json valid: tanpa error dan tanpa peringatan`, () => {
      const h = api.validate(kasus)
      expect(h.errors).toEqual([])
      expect(h.warnings).toEqual([])
    })

    it.skipIf(!ada)(`build() sama dengan ${excel} (deemed dan tarif BP21 dihitung rumus Excel)`, () => {
      expect(normal(api.build(kasus))).toBe(normal(readFileSync(path(excel), 'utf8')))
    })

    it.skipIf(!ada)(`check() meloloskan ${excel}`, () => {
      const h = api.check(readFileSync(path(excel), 'utf8'))
      expect(h.errors).toEqual([])
      expect(h.warnings).toEqual([])
    })
  })
}
