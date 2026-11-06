import type { HasilValidasi, MasalahValidasi } from 'coretax-xml'
import type { Sumber } from './baca-faktur.js'

export interface Laporan {
  berkas: string
  hasil: HasilValidasi
  /** Asal baris Excel/CSV, ada untuk `convert`. */
  sumber?: Sumber
  /** Path XML hasil `convert` yang berhasil. */
  keluaran?: string
}

/** Baris di file asal untuk sebuah masalah. */
function barisSumber(m: MasalahValidasi, s?: Sumber): { faktur?: number; item?: number } {
  if (!s || m.faktur === null) return {}
  const hasil: { faktur?: number; item?: number } = {}
  const f = s.faktur[m.faktur - 1]
  if (f !== undefined) hasil.faktur = f
  const i = m.item === null ? undefined : s.item[m.faktur - 1]?.[m.item - 1]
  if (i !== undefined) hasil.item = i
  return hasil
}

function lokasi(m: MasalahValidasi, s: Sumber | undefined, schema: string): string {
  if (m.faktur === null) return 'Dokumen'
  const b = barisSumber(m, s)
  let t = `${schema.startsWith('retur-') ? 'Retur' : 'Faktur'} ke-${m.faktur}`
  if (b.faktur !== undefined) t += ` (baris ${s?.jenis} ${b.faktur})`
  if (m.item !== null) {
    t += `, item ${m.item}`
    if (b.item !== undefined) t += ` (baris ${s?.jenis} ${b.item})`
  }
  return t
}

const ringkas = (l: Laporan) => `${l.hasil.errors.length} error, ${l.hasil.warnings.length} peringatan`

export function formatTeks(daftar: Laporan[]): string {
  const keluar: string[] = []
  for (const l of daftar) {
    keluar.push(
      `${l.berkas}: ${l.hasil.valid ? 'LOLOS' : 'DITOLAK'} (${ringkas(l)}; skema ${l.hasil.schema})`,
    )
    for (const [level, daftarMasalah] of [
      ['ERROR', l.hasil.errors],
      ['PERINGATAN', l.hasil.warnings],
    ] as const) {
      for (const m of daftarMasalah) {
        keluar.push(
          `  ${level} [${m.code}] ${lokasi(m, l.sumber, l.hasil.schema)}${m.element ? ` <${m.element}>` : ''}: ${m.pesan}`,
        )
        if (m.saran) keluar.push(`      saran: ${m.saran}`)
      }
    }
    if (l.keluaran) keluar.push(`  XML ditulis ke ${l.keluaran}`)
  }
  if (daftar.length > 1) {
    const lolos = daftar.filter((l) => l.hasil.valid).length
    keluar.push('', `${lolos} dari ${daftar.length} berkas lolos.`)
  }
  return `${keluar.join('\n')}\n`
}

export function formatJson(daftar: Laporan[]): string {
  const isi = daftar.map((l) => {
    const tambah = (m: MasalahValidasi) => ({ ...m, sumber: barisSumber(m, l.sumber) })
    return {
      berkas: l.berkas,
      valid: l.hasil.valid,
      schema: l.hasil.schema,
      ...(l.keluaran ? { keluaran: l.keluaran } : {}),
      errors: l.hasil.errors.map(tambah),
      warnings: l.hasil.warnings.map(tambah),
    }
  })
  return `${JSON.stringify(isi, null, 2)}\n`
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function formatHtml(daftar: Laporan[]): string {
  const bagian = daftar.map((l) => {
    const baris = [...l.hasil.errors, ...l.hasil.warnings]
      .map((m) => {
        const saran = m.saran ? `<br><small>Saran: ${esc(m.saran)}</small>` : ''
        return `<tr class="${m.level}"><td>${m.level === 'error' ? 'Error' : 'Peringatan'}</td><td>${esc(lokasi(m, l.sumber, l.hasil.schema))}</td><td>${esc(m.element ?? '')}</td><td>${esc(m.code)}</td><td>${esc(m.pesan)}${saran}</td></tr>`
      })
      .join('\n')
    const tabel = baris
      ? `<table><thead><tr><th>Level</th><th>Lokasi</th><th>Elemen</th><th>Kode</th><th>Pesan</th></tr></thead><tbody>\n${baris}\n</tbody></table>`
      : '<p>Tidak ada error atau peringatan.</p>'
    return `<section><h2>${esc(l.berkas)} <span class="${l.hasil.valid ? 'ok' : 'gagal'}">${l.hasil.valid ? 'LOLOS' : 'DITOLAK'}</span></h2><p>${esc(ringkas(l))}; skema ${esc(l.hasil.schema)}</p>${tabel}</section>`
  })
  return `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><title>Laporan coretax-xml</title>
<style>body{font:14px system-ui,sans-serif;margin:2rem;max-width:70rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:.4rem .6rem;text-align:left;vertical-align:top}tr.error td:first-child{color:#b00020;font-weight:600}tr.warning td:first-child{color:#8a6d00}.ok{color:#0a7a2f}.gagal{color:#b00020}small{color:#555}</style></head>
<body><h1>Laporan coretax-xml</h1><p><small>Bukan produk DJP dan bukan nasihat pajak. XML yang lolos pemeriksaan belum tentu diterima Coretax.</small></p>
${bagian.join('\n')}
</body></html>
`
}

export const formatLaporan = (format: 'teks' | 'json' | 'html', daftar: Laporan[]) =>
  format === 'json' ? formatJson(daftar) : format === 'html' ? formatHtml(daftar) : formatTeks(daftar)
