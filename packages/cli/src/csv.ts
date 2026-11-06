/** Parser CSV (RFC 4180; baris kosong dipertahankan supaya nomor baris sama dengan file): kutip ganda, kutip di dalam kutip (""), baris baru di dalam kutip. Pemisah , atau ; dikenali dari baris pertama. */
export function parseCsv(teks: string): string[][] {
  const s = teks.charCodeAt(0) === 0xfeff ? teks.slice(1) : teks
  const barisPertama = s.split(/\r?\n/, 1)[0] ?? ''
  const pemisah =
    (barisPertama.match(/;/g)?.length ?? 0) > (barisPertama.match(/,/g)?.length ?? 0) ? ';' : ','
  const hasil: string[][] = []
  let baris: string[] = []
  let sel = ''
  let kutip = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (kutip) {
      if (c === '"' && s[i + 1] === '"') {
        sel += '"'
        i++
      } else if (c === '"') kutip = false
      else sel += c
    } else if (c === '"') kutip = true
    else if (c === pemisah) {
      baris.push(sel)
      sel = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      baris.push(sel)
      sel = ''
      hasil.push(baris)
      baris = []
    } else sel += c
  }
  if (kutip) throw new Error('CSV tidak valid: tanda kutip tidak ditutup.')
  if (sel !== '' || baris.length > 0) {
    baris.push(sel)
    hasil.push(baris)
  }
  return hasil
}
