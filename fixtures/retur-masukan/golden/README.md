# Golden file retur faktur pajak masukan

Tujuan: membandingkan output library dengan XML dari **converter resmi DJP** untuk retur, seperti yang sudah dilakukan untuk [faktur keluaran](../../faktur-keluaran/golden/README.md). Sampai file ini ada, XML retur hanya terbukti cocok dengan satu sampel resmi (`fixtures/djp/Sample Retur Faktur PM Template v.1.1.xml`).

| File | Isi |
| --- | --- |
| `kasus.json` | 3 retur dalam format input library, lengkap dengan DPP, DPP lain, PPN, PPnBM (diperiksa library tanpa error dan peringatan) |
| `buat-xlsx.mjs` | Mengisi template Excel retur resmi dari `kasus.json` |
| `kasus.converter.xml` | **Hasil converter** (kamu yang membuat, lihat langkah di bawah) |

## Kasus

| # | Yang diuji |
| --- | --- |
| 1 | Retur dasar mirip contoh DJP: 1 dari 20 unit, PPnBM 20%, flag DPP lain = No |
| 2 | 2 item (barang dan jasa) dalam satu retur, diskon retur, flag DPP lain = Yes, karakter `& < >` di nama |
| 3 | Jumlah dan harga desimal (10,5 dan 14500,5), 3 retur dalam satu file |

NPWP dan nomor faktur semuanya rekaan.

## Cara membuat golden file

File Excel dan converter sudah disiapkan di `fixtures/djp/unduhan/retur.xlsx` (folder ini tidak masuk git). Kalau perlu membuat ulang:

```sh
node buat-xlsx.mjs <folder ConverterEfakturCoretax_v1.6> kasus.json ../../djp/unduhan/retur.xlsx
```

Lalu, di Windows:

1. Jalankan `fixtures/djp/unduhan/ConverterEfakturCoretax_v1.6/Converter.Efaktur.Coretax.exe`.
2. Pilih **Retur Pajak Masukan** (bukan Faktur Pajak Keluaran), klik **Browse**, pilih `retur.xlsx`, klik **Simpan**.
3. Converter menulis `retur.xml` di **folder kerja saat converter dijalankan** (mis. root repo). Pindahkan dan ganti nama menjadi `kasus.converter.xml` di folder ini.
4. Jalankan `pnpm test`. Dua test "converter resmi DJP" di `golden-retur.test.ts` otomatis aktif begitu file ada.

Kalau converter menampilkan `Error pada baris : N`, salin pesannya apa adanya.

## Probe pembulatan total dokumen (opsional, ± 3 menit)

Golden file pertama menunjukkan converter menulis **total dokumen dan FooterRow dalam rupiah utuh** (572916,67 menjadi 572917), sedangkan nilai per baris tetap berdesimal. Aturan untuk nilai persis `.5` belum diketahui. `probe-pembulatan.json` berisi dua retur dengan total persis x,5:

| Total di Excel | Setengah ke genap | Setengah ke atas | Dipotong |
| --- | --- | --- | --- |
| 100,5 / 102,5 / 0,5 (retur 1) | 100 / 102 / 0 | 101 / 103 / 1 | 100 / 102 / 0 |
| 101,5 / 103,5 / 1,5 (retur 2) | 102 / 104 / 2 | 102 / 104 / 2 | 101 / 103 / 1 |

Jalankan converter dengan `fixtures/djp/unduhan/retur-probe.xlsx` (langkah 2 sampai 3 di atas), simpan sebagai `probe-pembulatan.converter.xml`, lalu `pnpm test`. Library saat ini memakai setengah ke genap; test probe gagal jika converter memakai aturan lain.

## Yang dicari

- Apakah susunan elemen, penulisan `true`/`false`, dan format tanggal `DD-MM-YYYY` sama dengan output library.
- Apakah converter mengubah angka (misalnya 504166,67) atau menulis apa adanya.
- Apakah `FooterRow` diisi dari kolom Total di Excel (di file ini sama dengan kolom nilainya).
