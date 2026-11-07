import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { fakturKeluaran, katalogError } from '../src/index.js'

const berkas = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../../errors/katalog.json', import.meta.url)), 'utf8'),
) as Record<string, ReturnType<typeof katalogError>[string] & { tingkat: string[] }>

describe('errors/katalog.json', () => {
  it('sama dengan katalogError(); jika gagal jalankan `pnpm katalog`', () => {
    const sekarang = katalogError()
    expect(Object.keys(berkas)).toEqual(Object.keys(sekarang))
    for (const [kode, entri] of Object.entries(sekarang)) {
      const { tingkat: _, ...isi } = berkas[kode] ?? { tingkat: [] }
      expect(isi, kode).toEqual(entri)
    }
  })

  it('setiap kode punya tingkat error atau warning dan pesan Indonesia dan Inggris', () => {
    for (const [kode, entri] of Object.entries(berkas)) {
      expect(entri.tingkat.length, kode).toBeGreaterThan(0)
      expect(entri.id.pesan, kode).not.toBe('')
      expect(entri.en.pesan, kode).not.toBe('')
    }
  })

  it('template cocok dengan pesan sungguhan setelah parameter diisi', () => {
    const h = fakturKeluaran.validate({ penjual: { npwp: '1', nitku: '2' }, faktur: [] })
    for (const e of h.errors) {
      const t = berkas[e.code]?.id.pesan ?? ''
      // Semua teks tetap di template (selain {parameter}) harus muncul di pesan
      for (const potongan of t.split(/\{[^}]+\}/).filter((x) => x.trim())) expect(e.pesan).toContain(potongan)
    }
  })
})
