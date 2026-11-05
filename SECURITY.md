# Keamanan dan privasi

`coretax-xml` memproses NPWP, NIK, nama, dan alamat, yang termasuk data pribadi.

- Paket `coretax-xml` (core) tidak melakukan panggilan jaringan dan tidak membaca atau menulis file. Ini diuji di CI (`packages/core/test/privasi.test.ts`).
- Pesan error menyamarkan NPWP, NIK, dan NITKU secara default (`3201********0001`). Matikan dengan `samarkan: false` hanya di lingkungan yang aman.
- **Jangan** menempel data wajib pajak asli di issue, pull request, atau fixture.

## Melaporkan celah keamanan

Gunakan [GitHub private vulnerability reporting](https://github.com/cuikww/coretax-xml/security/advisories/new), bukan issue publik.
