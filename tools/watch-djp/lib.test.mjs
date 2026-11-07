import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bandingkan, ekstrakTautan, laporan } from './lib.mjs'

const h = (s, u = 10) => ({ sha256: s.padEnd(64, '0'), ukuran: u })

test('ekstrakTautan: absolut, tanpa duplikat, hanya berkas, entitas HTML didekode', () => {
  const html = `
    <a href="/sites/default/files/2025-03/Sample%20Faktur.xml.zip">a</a>
    <a href="https://pajak.go.id/sites/default/files/2026-01/Converter__v1.6.zip">b</a>
    <a href="https://pajak.go.id/sites/default/files/2026-01/Converter__v1.6.zip">dobel</a>
    <a href="/id/halaman-lain">bukan berkas</a>
    <a href="/sites/default/files/x.pdf?a=1&amp;b=2">pdf</a>
    <a href="mailto:x@y.z">surel</a>`
  assert.deepEqual(ekstrakTautan(html, 'https://www.pajak.go.id/id/x'), [
    'https://pajak.go.id/sites/default/files/2026-01/Converter__v1.6.zip',
    'https://www.pajak.go.id/sites/default/files/2025-03/Sample%20Faktur.xml.zip',
    'https://www.pajak.go.id/sites/default/files/x.pdf?a=1&b=2',
  ])
})

test('bandingkan: tanpa perubahan', () => {
  const s = { u1: h('aa'), u2: h('bb') }
  assert.equal(bandingkan(s, { ...s }).ada, false)
})

test('bandingkan: baru, hilang, dan berubah', () => {
  const lama = { u1: h('aa'), u2: h('bb'), u3: h('cc') }
  const baru = { u1: h('aa'), u2: h('zz', 99), u4: h('dd') }
  const d = bandingkan(lama, baru)
  assert.equal(d.ada, true)
  assert.deepEqual(d.ditambah, ['u4'])
  assert.deepEqual(d.dihapus, ['u3'])
  assert.equal(d.berubah.length, 1)
  assert.equal(d.berubah[0].url, 'u2')
  assert.equal(d.berubah[0].ke.ukuran, 99)
})

test('laporan: memuat bagian yang relevan saja dan daftar tindakan', () => {
  const d = bandingkan(
    { 'https://x/a%20b.zip': h('aa') },
    { 'https://x/a%20b.zip': h('bb'), 'https://x/baru.xlsx': h('cc') },
  )
  const teks = laporan(d, [{ url: 'https://x/gagal.pdf', galat: 'HTTP 503' }], '2026-11-07')
  assert.match(teks, /Berkas yang isinya berubah/)
  assert.match(teks, /\[a b\.zip\]\(https:\/\/x\/a%20b\.zip\)/)
  assert.match(teks, /Berkas baru di halaman/)
  assert.doesNotMatch(teks, /hilang dari halaman/)
  assert.match(teks, /gagal\.pdf: HTTP 503/)
  assert.match(teks, /maksimal 7 hari/)
})
