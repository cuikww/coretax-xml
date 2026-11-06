/**
 * Bulatkan angka teks ke 2 desimal dengan setengah ke genap, persis seperti converter resmi DJP
 * (diuji dengan probe-pembulatan di fixtures: 0,025 -> 0,02; 0,035 -> 0,04; 2,675 -> 2,68; 100,125 -> 100,12).
 * Nilai yang bukan angka dikembalikan apa adanya supaya library yang melaporkan salahnya.
 */
export function bulat2(nilai: string | undefined): string | undefined {
  if (nilai === undefined) return undefined
  let s = nilai.trim()
  if (/e/i.test(s)) {
    const n = Number(s)
    if (!Number.isFinite(n)) return s
    s = n.toFixed(12).replace(/\.?0+$/, '')
  }
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s)
  if (!m) return s
  const [, tanda = '', bulat = '0', pecahan = ''] = m
  if (pecahan.length <= 2) return s
  const dasar = BigInt(bulat + pecahan.slice(0, 2))
  const sisa = pecahan.slice(2)
  const naik =
    (sisa[0] as string) > '5' || (sisa[0] === '5' && (/[1-9]/.test(sisa.slice(1)) || dasar % 2n === 1n))
  const hasil = (naik ? dasar + 1n : dasar).toString().padStart(3, '0')
  return `${tanda}${hasil.slice(0, -2)}.${hasil.slice(-2)}`
}

/** Tanggal dari sel Excel (nomor seri) atau teks DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD menjadi YYYY-MM-DD. */
export function tanggalIso(nilai: string | undefined): string {
  const t = (nilai ?? '').trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)
  if (m) return `${m[3]}-${(m[2] as string).padStart(2, '0')}-${(m[1] as string).padStart(2, '0')}`
  if (/^\d+(\.\d+)?$/.test(t)) {
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(t)) * 86400000).toISOString().slice(0, 10)
  }
  return t // biarkan library melaporkan DATE_FORMAT
}
