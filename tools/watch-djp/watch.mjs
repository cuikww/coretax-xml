// Pemantau halaman template DJP: unduh semua berkas yang ditautkan, hitung SHA-256, bandingkan dengan state.json.
// Pemakaian: node tools/watch-djp/watch.mjs [--state tools/watch-djp/state.json] [--laporan laporan.md]
// Keluaran untuk GitHub Actions ($GITHUB_OUTPUT): changed=true|false, baseline=true|false.
// Tanpa dependensi (Node >= 20, fetch bawaan). Hanya membaca halaman publik; tidak mengirim data apa pun.
import { createHash } from 'node:crypto'
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { bandingkan, ekstrakTautan, HALAMAN, laporan } from './lib.mjs'

const { values: a } = parseArgs({
  options: {
    state: { type: 'string', default: 'tools/watch-djp/state.json' },
    laporan: { type: 'string', default: 'laporan-djp.md' },
  },
})
const UA = 'Mozilla/5.0 (compatible; coretax-xml-pemantau)'
// biome-ignore lint/suspicious/noUndeclaredEnvVars: skrip mandiri di luar tugas turbo; variabel disediakan GitHub Actions
const fileKeluaranGh = process.env.GITHUB_OUTPUT
const keluaran = (k, v) => {
  console.log(`${k}=${v}`)
  if (fileKeluaranGh) appendFileSync(fileKeluaranGh, `${k}=${v}\n`)
}

async function ambil(url, percobaan = 3) {
  let galat
  for (let i = 1; i <= percobaan; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(180_000) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (e) {
      galat = e
      await new Promise((r) => setTimeout(r, 2000 * i))
    }
  }
  throw new Error(galat instanceof Error ? (galat.cause?.code ?? galat.message) : String(galat))
}

const html = (await ambil(HALAMAN)).toString('utf8')
const tautan = ekstrakTautan(html)
if (tautan.length < 10) {
  // Halaman berubah bentuk atau diblokir: gagal keras supaya terlihat, jangan dianggap "semua berkas dihapus"
  throw new Error(
    `Hanya ${tautan.length} tautan berkas ditemukan di halaman DJP; halaman mungkin berubah atau memblokir akses.`,
  )
}

const lama = existsSync(a.state) ? JSON.parse(readFileSync(a.state, 'utf8')) : null
const baru = {}
const gagal = []
let indeks = 0
async function pekerja() {
  while (indeks < tautan.length) {
    const url = tautan[indeks++]
    try {
      const data = await ambil(url)
      baru[url] = { sha256: createHash('sha256').update(data).digest('hex'), ukuran: data.length }
    } catch (e) {
      const sebelumnya = lama?.berkas?.[url]
      gagal.push({ url, galat: e.message })
      if (sebelumnya) baru[url] = sebelumnya // jangan dianggap berubah atau hilang hanya karena gagal unduh
    }
  }
}
await Promise.all(Array.from({ length: 4 }, pekerja))

const urut = (o) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)))
const tanggal = new Date().toISOString().slice(0, 10)
const tulisState = () =>
  writeFileSync(
    a.state,
    `${JSON.stringify({ diperiksa: tanggal, sumber: HALAMAN, berkas: urut(baru) }, null, 2)}\n`,
  )

if (!lama) {
  tulisState()
  keluaran('baseline', 'true')
  keluaran('changed', 'false')
  console.log(`Baseline dibuat: ${Object.keys(baru).length} berkas, ${gagal.length} gagal diunduh.`)
} else {
  const diff = bandingkan(lama.berkas, baru)
  keluaran('baseline', 'false')
  keluaran('changed', String(diff.ada))
  if (diff.ada) {
    writeFileSync(a.laporan, laporan(diff, gagal, tanggal))
    tulisState()
    console.log(
      `Perubahan: ${diff.berubah.length} berubah, ${diff.ditambah.length} baru, ${diff.dihapus.length} hilang. Laporan: ${a.laporan}`,
    )
  } else {
    console.log(
      `Tidak ada perubahan (${Object.keys(baru).length} berkas diperiksa, ${gagal.length} gagal diunduh).`,
    )
  }
}
for (const g of gagal) console.warn(`Gagal diunduh: ${g.url}: ${g.galat}`)
