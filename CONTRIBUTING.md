# Kontribusi

Terima kasih sudah mau membantu. Kontribusi yang paling dibutuhkan:

1. **Golden file dari converter resmi DJP** (lihat `fixtures/README.md`). Ini menentukan apakah output library benar.
2. **Laporan impor Coretax**: XML hasil library yang diterima atau ditolak Coretax, dengan data yang sudah disamarkan.
3. **Review aturan pajak** oleh konsultan atau staf pajak: kode transaksi, DPP nilai lain, pembulatan.
4. **Tabel referensi lengkap** dari sheet REF template DJP (nama satuan, kode TD, negara).

## Menjalankan proyek

```sh
corepack enable
pnpm install
pnpm build
pnpm test
pnpm lint
```

Node.js 20 atau lebih baru.

## Aturan

- Setiap aturan validasi punya test lolos dan gagal.
- Setiap kode error baru punya pesan Bahasa Indonesia dan Inggris di `packages/core/src/messages.ts`, lalu jalankan `pnpm katalog` dan commit `errors/katalog.json` (CI gagal jika katalog basi).
- Skema yang sudah dirilis tidak diubah. Template DJP baru = file skema baru (`schemas/faktur-keluaran/vYYYY-MM.ts`).
- Core tetap tanpa dependensi runtime dan tanpa akses jaringan.
- Catat perubahan dengan `pnpm changeset`. Skema baru = minor, perbaikan aturan = patch.
- Jangan pernah commit data wajib pajak asli.
