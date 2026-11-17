// Terbitkan setiap paket di packages/ yang versinya belum ada di npm, lalu buat tag git <nama>@<versi>.
// Pemakaian (dari root, setelah build): node scripts/terbitkan.mjs [--dry-run]
//
// Pengganti `changeset publish`: changesets 2.31 memanggil `pnpm publish`, yang di pnpm 11 tidak memakai token OIDC
// GitHub (trusted publishing) dan error-nya tidak bisa dibaca changesets. Di sini paket dikemas dengan `pnpm pack`
// (mengganti workspace:* dengan nomor versi) lalu diterbitkan dengan `npm publish`, yang mendukung OIDC dan provenance.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dryRun = process.argv.includes('--dry-run')
const win = process.platform === 'win32'
const jalan = (cmd, args, cwd, stderr = 'inherit') =>
  execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', stderr], shell: win })

// Urutan: core dulu, karena cli bergantung padanya
const urutan = ['core', 'cli']
const semua = readdirSync('packages')
for (const d of semua) if (!urutan.includes(d)) urutan.push(d)

const tmp = mkdtempSync(join(tmpdir(), 'terbitkan-'))
let gagal = false
for (const dir of urutan) {
  const folder = join('packages', dir)
  const pkg = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'))
  if (pkg.private) continue
  const id = `${pkg.name}@${pkg.version}`
  let sudahAda = false
  try {
    sudahAda = jalan('npm', ['view', id, 'version'], folder, 'ignore').trim() === pkg.version
  } catch {
    // 404: belum pernah terbit
  }
  if (sudahAda) {
    console.log(`${id} sudah ada di npm, dilewati`)
    continue
  }
  try {
    const keluaran = join(tmp, dir)
    jalan('pnpm', ['pack', '--pack-destination', keluaran], folder)
    const tgz = join(
      keluaran,
      readdirSync(keluaran).find((f) => f.endsWith('.tgz')),
    )
    const args = ['publish', tgz, '--access', 'public']
    if (!dryRun) args.push('--provenance')
    else args.push('--dry-run')
    jalan('npm', args, folder)
    console.log(`${dryRun ? '(dry-run) ' : ''}${id} diterbitkan`)
    if (!dryRun) jalan('git', ['tag', id])
  } catch (e) {
    console.error(`Gagal menerbitkan ${id}: ${e.message}`)
    gagal = true
    break // jangan terbitkan cli jika core gagal
  }
}
rmSync(tmp, { recursive: true, force: true })
process.exit(gagal ? 1 : 0)
