# Golden file faktur keluaran

Tujuan: membandingkan output library dengan XML dari **converter resmi DJP** (Gerbang 1 di [PRD](../../../docs/PRD.md#roadmap)).

| File | Isi |
| --- | --- |
| `kasus.json` | 10 faktur uji dalam format input library, lengkap dengan DPP, DPP nilai lain, PPN, PPnBM (sudah diperiksa library di mode `strict`) |
| `probe-pembulatan.json` | 1 faktur dengan angka 3 desimal, hanya untuk mengintip cara converter membulatkan; **bukan** input yang sah untuk library |
| `buat-xlsx.mjs` | Mengisi template Excel resmi dari salah satu JSON di atas |
| `kasus.converter.xml` | **Hasil converter** untuk `kasus.json` (kamu yang membuat, lihat langkah di bawah) |
| `probe-pembulatan.converter.xml` | Hasil converter untuk `probe-pembulatan.json` |

## Kasus uji

| # | Kode | Yang diuji |
| --- | --- | --- |
| 1 | 01 | Kasus dasar, pembeli NPWP, DPP nilai lain = DPP |
| 2 | 04 | Jasa, DPP nilai lain 11/12 |
| 3 | 04 | 3 item (barang dan jasa), diskon, jumlah desimal (10,5), karakter `& < > "` di nama dan alamat, email kosong |
| 4 | 04 | Pembulatan 11/12 dan PPN ke 2 desimal |
| 5 | 07 | Keterangan tambahan, cap fasilitas, dokumen pendukung + periode, PPnBM 20% |
| 6 | 08 | Keterangan tambahan dan cap fasilitas kode 08 |
| 7 | 04 | Pembeli NIK (`National ID`) |
| 8 | 06 | Pembeli paspor, negara SGP |
| 9 | 04 | PPnBM 10% |
| 10 | 09 | Harga dan jumlah desimal |

NPWP, NIK, dan nama semuanya rekaan. Catatan: untuk kode 07 dan 08, PPN diisi `tarif x DPP nilai lain` seperti sampel resmi DJP; apakah Coretax menerima nilai itu untuk fasilitas "tidak dipungut" atau "dibebaskan" belum diketahui dan baru terjawab saat uji impor nyata.

## Cara membuat golden file

File Excel dan converter sudah disiapkan di `fixtures/djp/unduhan/` (folder ini tidak masuk git). Kalau perlu membuat ulang:

```sh
node buat-xlsx.mjs <folder ConverterEfakturCoretax_v1.6> kasus.json ../../djp/unduhan/kasus.xlsx
node buat-xlsx.mjs <folder ConverterEfakturCoretax_v1.6> probe-pembulatan.json ../../djp/unduhan/probe-pembulatan.xlsx
```

Lalu, di Windows:

1. Jalankan `fixtures/djp/unduhan/ConverterEfakturCoretax_v1.6/Converter.Efaktur.Coretax.exe`.
2. Pilih **Faktur Pajak Keluaran**, klik **Browse**, pilih `kasus.xlsx`, klik **Simpan**.
3. Simpan hasilnya sebagai `kasus.converter.xml` di folder ini.
4. Ulangi untuk `probe-pembulatan.xlsx` dan simpan sebagai `probe-pembulatan.converter.xml`.
5. Jalankan `pnpm test`. Test "build() sama dengan XML dari converter resmi DJP" otomatis aktif begitu `kasus.converter.xml` ada.

Kalau converter menampilkan `Error pada baris : N`, salin pesannya apa adanya.

## Yang dicari dari probe pembulatan

Nilai 0,005 / 0,015 / 0,025 / 0,035 / 2,675 / 100,125 diisi di semua kolom angka. Dari XML hasilnya terbaca:

- Apakah converter membulatkan, memotong, atau menolak angka lebih dari 2 desimal.
- Jika membulatkan: ke genap (0,005 → 0,00 dan 0,025 → 0,02) atau setengah ke atas (0,005 → 0,01 dan 0,025 → 0,03). Library saat ini setengah ke atas.
- Bagaimana angka ditulis (`0.01` atau `0,01` atau `1E-02`).
