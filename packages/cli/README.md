# @coretax-xml/cli

Ubah template Excel faktur pajak keluaran DJP (atau CSV sederhana) menjadi XML impor Coretax, dan periksa XML sebelum diunggah. Berjalan lokal, tanpa internet.

> **Pra-rilis (v0.2 dini).** Belum diuji impor di Coretax sungguhan dan belum terbit di npm. Bukan produk DJP dan bukan nasihat pajak. XML yang lolos pemeriksaan belum tentu diterima Coretax.

## Pemakaian

```sh
# Template Excel resmi DJP -> XML di sebelah file Excel-nya. Jenisnya dikenali dari nama sheet:
#   Faktur + DetailFaktur = faktur pajak keluaran; Retur + DetailRetur = retur faktur pajak masukan
coretax-xml convert penjualan.xlsx
coretax-xml convert penjualan.xlsx -o faktur-oktober.xml

# CSV sederhana: satu baris per item, data faktur diulang di tiap baris
coretax-xml template faktur-keluaran -o contoh.csv
coretax-xml convert contoh.csv

# Periksa XML yang sudah ada (buatan converter DJP atau aplikasi lain), satu file atau satu folder.
# Faktur keluaran dan retur masukan dikenali dari elemen akar.
coretax-xml check faktur-oktober.xml
coretax-xml check folder-xml/ --format html -o laporan.html

coretax-xml schemas
```

Kode keluar: `0` lolos, `1` ada error pada data, `2` salah pemakaian atau file tidak dikenal. Format laporan: `--format teks|json|html`.

## Error menunjuk baris Excel

```
penjualan.xlsx: DITOLAK (1 error, 0 peringatan; skema faktur-keluaran@2025.09)
  ERROR [UNIT_UNKNOWN] Faktur ke-2 (baris Excel 5), item 1 (baris Excel 3) <Unit>: Satuan "UM.9999" tidak ada di skema 2025.09.
```

Nomor baris adalah baris di sheet `Faktur` dan `DetailFaktur` (atau baris CSV), bukan baris di XML.

## Cara angka dibaca

| Sumber | Default `--hitung` | Arti |
| --- | --- | --- |
| `.xlsx` DJP | `strict` | DPP, DPP nilai lain, PPN, dan PPnBM dibaca dari sel (hasil rumus yang tersimpan di file) dan dicocokkan dengan hitungan library. Angka lebih dari 2 desimal dibulatkan **setengah ke genap**, seperti converter DJP. |
| `.csv` | `otomatis` | Library menghitung semuanya dari harga, jumlah, dan diskon. |

`--hitung otomatis` pada file Excel mengabaikan angka di sel dan menghitung ulang; berguna jika rumus di template sudah diubah.

Excel menyimpan rumus beserta hasil terakhir yang dihitungnya. CLI hanya membaca hasil itu dan tidak menghitung ulang rumus. Buka dan simpan file di Excel dulu jika angkanya baru diubah lewat program lain.

## Keterbatasan

- Faktur pajak keluaran (Excel dan CSV) dan retur faktur pajak masukan (hanya Excel). Bukti potong menyusul.
- `.xls` lama tidak didukung; simpan sebagai `.xlsx`.
- Angka CSV memakai titik desimal tanpa pemisah ribuan (`1500.50`, bukan `1.500,50`).
- Kode barang dan kode transaksi yang kehilangan nol di depan karena Excel (`4`, `0`) dipulihkan menjadi `04` dan `000000`.
- Template DJP sebagai file `.xlsx` tidak disertakan di repo ini; unduh dari [halaman resmi DJP](https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml).

Lisensi MIT.
