export const HALAMAN = 'https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml'

const EKSTENSI = /\.(zip|xlsx?|xml|pdf|rar|exe)(\?|#|$)/i

/** Semua tautan berkas (zip, xlsx, xml, pdf, ...) di halaman, sebagai URL absolut tanpa duplikat, terurut. */
export function ekstrakTautan(html, dasar = HALAMAN) {
  const hasil = new Set()
  for (const m of html.matchAll(/href\s*=\s*"([^"]+)"/gi)) {
    const href = (m[1] ?? '').replaceAll('&amp;', '&').trim()
    if (!EKSTENSI.test(href)) continue
    try {
      hasil.add(new URL(href, dasar).href)
    } catch {
      // tautan rusak: abaikan
    }
  }
  return [...hasil].sort()
}

/**
 * Bandingkan dua peta {url: {sha256, ukuran}}.
 * ditambah = url baru, dihapus = url hilang dari halaman, berubah = url sama tapi isi berbeda.
 */
export function bandingkan(lama, baru) {
  const ditambah = Object.keys(baru)
    .filter((u) => !(u in lama))
    .sort()
  const dihapus = Object.keys(lama)
    .filter((u) => !(u in baru))
    .sort()
  const berubah = Object.keys(baru)
    .filter((u) => u in lama && lama[u].sha256 !== baru[u].sha256)
    .sort()
    .map((url) => ({ url, dari: lama[url], ke: baru[url] }))
  return { ditambah, dihapus, berubah, ada: ditambah.length + dihapus.length + berubah.length > 0 }
}

const nama = (url) => decodeURIComponent(url.split('/').pop() ?? url)
const ringkasHash = (h) => `\`${h.sha256.slice(0, 12)}\` (${h.ukuran} byte)`

/** Isi issue GitHub (Markdown, Bahasa Indonesia) untuk sebuah perbedaan. */
export function laporan(diff, gagal, tanggal, halaman = HALAMAN) {
  const baris = [
    `Pemantau mingguan menemukan perubahan di [halaman template DJP](${halaman}) pada ${tanggal}.`,
    '',
  ]
  if (diff.berubah.length > 0) {
    baris.push(
      '### Berkas yang isinya berubah',
      '',
      '| Berkas | Hash lama | Hash baru |',
      '| --- | --- | --- |',
    )
    for (const b of diff.berubah)
      baris.push(`| [${nama(b.url)}](${b.url}) | ${ringkasHash(b.dari)} | ${ringkasHash(b.ke)} |`)
    baris.push('')
  }
  if (diff.ditambah.length > 0) {
    baris.push('### Berkas baru di halaman', '', ...diff.ditambah.map((u) => `- [${nama(u)}](${u})`), '')
  }
  if (diff.dihapus.length > 0) {
    baris.push(
      '### Berkas yang hilang dari halaman',
      '',
      ...diff.dihapus.map((u) => `- ${nama(u)} (${u})`),
      '',
    )
  }
  if (gagal.length > 0) {
    baris.push(
      '### Tidak bisa diunduh (hash lama dipertahankan)',
      '',
      ...gagal.map((g) => `- ${nama(g.url)}: ${g.galat}`),
      '',
    )
  }
  baris.push(
    '### Yang perlu dilakukan',
    '',
    '- [ ] Unduh berkas yang berubah dan baca catatan rilis (converter: `Release Notes Converter`; template Excel: sheet `Rilis note`)',
    '- [ ] Bandingkan urutan elemen dan tabel referensi dengan skema yang ada (`packages/core/src/schemas`)',
    '- [ ] Perbarui `fixtures/djp/README.md` (hash dan tanggal unduh) dan buat golden file baru bila format berubah',
    '- [ ] Rilis skema baru sebagai versi minor, target maksimal 7 hari setelah template DJP terbit',
    '',
    'Issue ini dibuat otomatis oleh `tools/watch-djp`. `tools/watch-djp/state.json` sudah diperbarui oleh workflow.',
  )
  return `${baris.join('\n')}\n`
}
