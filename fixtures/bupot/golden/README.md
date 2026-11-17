# Golden file bukti potong PPh 21 dan 26

Bukti potong tidak memakai converter `.exe`. DJP menyediakan file Excel ("BP21 Excel to XML v.4.xlsx", "BP26 Excel to XML.xlsx") dengan **XML Map**: XML dibuat dari Excel sendiri lewat *Developer > Export*. Golden file di sini adalah hasil ekspor itu.

| File | Isi |
| --- | --- |
| `kasus-bp21.json` | 17 bukti potong PPh 21 dalam format input library, **tanpa** deemed dan tarif |
| `kasus-bp26.json` | 2 bukti potong PPh 26 (satu lengkap dengan paspor dan KITAS, satu memakai SKD) |
| `buat-xlsx.mjs` | Mengisi sheet DATA template Excel resmi dari JSON |
| `kasus-bp21.excel.xml`, `kasus-bp26.excel.xml` | **Hasil ekspor Excel** (kamu yang membuat, lihat langkah di bawah) |

## Yang diuji

Untuk BP21, skrip **tidak** mengisi kolom Deemed dan Tarif. Rumus baris 4 template DJP disalin ke setiap baris, jadi saat file dibuka Excel menghitung deemed dan tarif dengan rumus resmi. Library menghitung sendiri dari tabel di `packages/core/src/schemas/bupot/`. Test membandingkan keduanya.

| # | Kode objek pajak | Penghasilan | PTKP | Yang diuji | Tarif menurut library |
| --- | --- | --- | --- | --- | --- |
| 1 | 21-100-35 | 5.400.000 | TK/0 | TER A, tepat di batas | 0 |
| 2 | 21-100-35 | 5.400.001 | TK/1 | TER A, lewat batas | 0,25 |
| 3 | 21-100-35 | 9.200.000 | K/1 | TER B, tepat di batas | 1 |
| 4 | 21-100-35 | 1.500.000.000 | K/3 | TER C, lapisan teratas | 34 |
| 5 | 21-100-10 | 20.000.000 | TK/2 | TER B, kode lain | 8 |
| 6 | 21-100-07 | 120.000.000 | TK/0 | Pasal 17, deemed 50% (DPP tepat 60 juta) | 5 |
| 7 | 21-100-07 | 120.000.000,02 | TK/0 | Pasal 17, DPP lewat 60 juta 1 sen | 15 |
| 8 | 21-100-17 | 6.000.000.000 | K/0 | Pasal 17, lapisan teratas | 35 |
| 9 | 21-100-24 | 450.000 | TK/0 | Harian, tepat di batas | 0 |
| 10 | 21-100-29 | 1.000.000 | TK/0 | Harian | 0,5 |
| 11 | 21-402-04 | 3.000.000 | TK/0 | Tarif tetap | 0 |
| 12 | 21-402-03 | 3.000.000 | TK/0 | Tarif tetap | 15 |
| 13 | 21-401-01 | 75.000.000 | K/2 | Pesangon | 5 |
| 14 | 21-401-01 | 600.000.000 | K/2 | Pesangon, lapisan teratas | 25 |
| 15 | 21-401-02 | 50.000.000 | TK/3 | Pensiun, tepat di batas | 0 |
| 16 | 21-401-02 | 50.000.001 | TK/3 | Pensiun | 5 |
| 17 | 21-100-35 | 1.234.567,5 | TK/0 | Penghasilan desimal, `& < >` di nomor dokumen, tanggal dokumen kosong | 0 |

Untuk BP26 yang dicari: cara Excel menulis elemen kosong (paspor, KITAS, tanggal lahir di baris 2), `&` di nama, dan angka desimal.

NPWP semuanya rekaan.

## Cara membuat golden file (± 5 menit, Excel di Windows)

File Excel sudah disiapkan di `fixtures/djp/unduhan/bupot21-golden.xlsx` dan `bupot26-golden.xlsx` (folder ini tidak masuk git). Kalau perlu membuat ulang:

```sh
node buat-xlsx.mjs "../../djp/unduhan/bupot/BP21 Excel to XML v.4.xlsx" kasus-bp21.json ../../djp/unduhan/bupot21-golden.xlsx
node buat-xlsx.mjs "../../djp/unduhan/bupot/BP26 Excel to XML.xlsx" kasus-bp26.json ../../djp/unduhan/bupot26-golden.xlsx
```

Lalu, untuk masing-masing file:

1. Buka di Excel. Jika muncul *Protected View* atau *Enable Editing*, klik **Enable Editing**.
2. Pastikan kolom Deemed dan Tarif di sheet DATA sudah berisi angka (BP21). Jika masih kosong, tekan **Ctrl+Alt+F9**.
3. Aktifkan tab **Developer** jika belum ada: *File > Options > Customize Ribbon*, centang **Developer**.
4. Klik sel mana saja di dalam tabel sheet DATA, lalu **Developer > Export** (grup XML).
5. Simpan sebagai `kasus-bp21.excel.xml` (atau `kasus-bp26.excel.xml`) di folder ini. **Jangan** simpan file Excel-nya.
6. Jalankan `pnpm test`. Test di `packages/core/test/golden-bupot.test.ts` otomatis aktif begitu file ada.

Jika Export menampilkan pesan validasi atau tidak bisa memilih map, salin pesannya apa adanya.

## Yang dicari

- Apakah tarif dari rumus Excel sama dengan tabel library di setiap batas.
- Apakah Excel menulis `xsi:nil="true"` atau menghilangkan elemen untuk sel kosong.
- Apakah angka desimal ditulis `1234567.5` dan tanggal `YYYY-MM-DD`.
