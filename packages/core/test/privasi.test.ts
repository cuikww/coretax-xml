import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// Core tidak boleh melakukan panggilan jaringan atau membaca file: data pajak tidak boleh keluar perangkat.
const src = fileURLToPath(new URL('../src', import.meta.url))

function semuaFile(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? semuaFile(p) : [p]
  })
}

const TERLARANG = [
  /\bfetch\s*\(/,
  /XMLHttpRequest/,
  /WebSocket/,
  /navigator\.sendBeacon/,
  /from\s+['"](node:)?(http|https|net|dgram|tls|child_process|fs)['"]/,
  /require\(\s*['"](node:)?(http|https|net|dgram|tls|child_process|fs)['"]\s*\)/,
]

describe('privasi', () => {
  for (const file of semuaFile(src)) {
    it(`tanpa jaringan dan akses file: ${file.slice(src.length + 1)}`, () => {
      const isi = readFileSync(file, 'utf8')
      for (const pola of TERLARANG) expect(isi).not.toMatch(pola)
    })
  }
})
