# Panduan uji impor Coretax (Gerbang 1)

Untuk mitra uji (PKP atau konsultan pajak) dan developer yang menyiapkan filenya.

## Tujuan

`coretax-xml` membuat file XML faktur pajak keluaran. Yang belum diketahui: **apakah Coretax benar-benar menerima file itu**. Uji ini menjawabnya dengan mengimpor 10 faktur contoh dan mencatat hasilnya. Tidak ada faktur yang perlu diterbitkan.

Yang kami minta dari mitra: akun Coretax PKP, sekitar 30 menit, dan kesediaan menyalin pesan error apa adanya.

## Peringatan sebelum mulai

- **Impor membuat faktur di Coretax.** Menurut dokumen DJP, faktur hasil impor muncul di daftar Pajak Keluaran dengan status `CREATED`. **Jangan mengunggah atau menerbitkan** faktur-faktur ini ke DJP. Pastikan dulu bagaimana cara menghapus draf faktur di akun yang dipakai, atau pakai akun uji bila ada.
- Faktur contoh bukan transaksi nyata. Jangan gunakan untuk pelaporan SPT.
- Library ini bukan produk DJP dan bukan nasihat pajak. Kami mencatat apa yang Coretax terima atau tolak, bukan menilai benar-salahnya perlakuan pajak.

## Bagian A: developer menyiapkan file

Butuh Node.js 20 atau lebih baru dan pnpm. Jalankan di mesin yang aman, karena file hasilnya berisi identitas nyata.

```sh
pnpm install
pnpm build
node scripts/siapkan-uji-impor.mjs \
  --npwp-penjual 1111222233334444 --nitku-penjual 1111222233334444000000 \
  --npwp-pembeli 5555666677778888 --nitku-pembeli 5555666677778888000000 \
  --nik 3333444455556666 \
  --tanggal 2026-11-05 \
  --keluar uji-impor-keluar
```

| Opsi | Arti |
| --- | --- |
| `--npwp-penjual`, `--nitku-penjual` | NPWP (16 digit) dan NITKU (22 digit) milik mitra, yang akan login ke Coretax |
| `--npwp-pembeli`, `--nitku-pembeli` | Pembeli untuk kasus NPWP. Sebaiknya pihak lain yang terdaftar; tanpa opsi ini pembeli = penjual sendiri |
| `--nik` | NIK nyata untuk kasus pembeli perorangan (kasus 07). Tanpa ini kasus 07 hampir pasti ditolak |
| `--tanggal` | Tanggal semua faktur (YYYY-MM-DD). Pilih tanggal di masa pajak yang boleh diimpor |
| `--retur` | File JSON retur faktur masukan yang diisi mitra (lihat bagian retur di bawah); boleh dipakai tanpa opsi faktur keluaran |
| `--keluar` | Folder hasil (bawaan `uji-impor-keluar`, tidak masuk git) |

Hasilnya satu XML per kasus (`01-kode01.xml` dan seterusnya), `semua.xml` berisi ke-10 faktur, dan `lembar-hasil.md` untuk dicatat mitra. Kalau data tidak valid, skrip menampilkan daftar errornya dan berhenti.

**Jangan commit atau kirim `uji-impor-keluar/` ke tempat umum.** Folder itu berisi NPWP dan NIK nyata.

### Retur faktur pajak masukan (opsional, terpisah dari 10 kasus di atas)

Berbeda dengan faktur keluaran, retur **tidak bisa direkayasa**: Coretax mencocokkan nomor faktur, penjual, dan setiap barang dengan faktur masukan yang sudah ada di akun, dan membatasi jumlah retur sampai saldo faktur itu. Karena itu mitra yang menyiapkan datanya:

1. Pilih satu faktur pajak masukan di akun mitra (mitra = pembeli) yang boleh diuji retur.
2. Salin `fixtures/retur-masukan/contoh-uji-impor.json` dan isi dari faktur itu: NPWP pembeli (`pembeli.npwp`), nomor faktur 17 digit, NPWP penjual, tanggal retur, dan untuk setiap barang nama, kode, satuan, harga, dan jumlah **persis seperti di faktur asal**, plus `jumlahRetur` dan `ppn`. PPN retur wajib diisi sendiri karena tidak bisa dihitung. Beri `"pakaiDppLain": true` dan `dppLain` bila faktur asal memakai DPP nilai lain.
3. Jalankan skrip dengan `--retur`, sendiri atau bersama opsi faktur keluaran:

```sh
node scripts/siapkan-uji-impor.mjs --retur retur-mitra.json --keluar uji-impor-keluar
```

Hasilnya satu XML per retur (`R01-retur-xxxxxx.xml`, ...) dan baris retur di `lembar-hasil.md`. Impor lewat menu retur pajak masukan di Coretax (nama menu dan langkahnya belum didokumentasikan di sini; catat yang dipakai di kolom catatan). **Hapus draf retur setelah uji** bila Coretax membuatnya. Yang dijawab uji ini: apakah total dokumen dalam rupiah utuh (seperti converter DJP) dan nilai per baris berdesimal diterima, dan apakah PPN retur yang diisi sendiri lolos validasi Coretax.

## Bagian B: mitra mengimpor ke Coretax

Langkah menurut dokumen DJP [Mekanisme Upload Faktur via XML](https://www.pajak.go.id/sites/default/files/2025-01/Mekanisme%20Upload%20Faktur%20via%20XML.pdf):

1. Login ke Coretax dengan akun penjual (NPWP yang dipakai di Bagian A), buka menu **eTax Invoice → Pajak Keluaran**.
2. Klik **Impor data → Browse**, pilih `01-kode01.xml`, lalu **Open**. Pesan `Success Upload XML` berarti file diterima untuk diproses, **bukan** berarti isinya valid.
3. Klik **XML Monitoring** dan perhatikan statusnya:

   | Status | Arti |
   | --- | --- |
   | `VALIDATING DATA` | Sedang divalidasi, tunggu lalu muat ulang |
   | `VALIDATING FAILED` | Ada data yang ditolak. Klik ikon mata di kolom **Message Detail** untuk melihat errornya |
   | `CREATING INVOICE` | Faktur sedang dibuat |
   | `CREATING INVOICE FINISHED` | Semua faktur berhasil dibuat |

4. Buka faktur hasilnya di daftar Pajak Keluaran. Bandingkan **DPP, DPP nilai lain, PPN, dan PPnBM** yang tampil di Coretax dengan yang ada di file. Catat setiap selisih sekecil apa pun.
5. Isi satu baris di `lembar-hasil.md` per file, lalu ulangi untuk file berikutnya. Setelah semua file satuan selesai, coba `semua.xml`.

Kalau satu file ditolak, tetap lanjutkan ke file berikutnya: setiap kasus menguji hal yang berbeda.

## Cara mencatat hasil

- **Hasil:** `LOLOS` atau `DITOLAK`.
- **Pesan error:** salin dari **Message Detail** apa adanya, termasuk nomor baris atau nama field. Ganti NPWP, NIK, dan nama dengan `***`.
- **Selisih angka:** tulis nilai di Coretax dan nilai di file, misalnya `PPN file 4074,17; Coretax 4074,18`.

Kirim `lembar-hasil.md` yang sudah diisi (tanpa file XML) ke maintainer, atau buka issue dengan label `uji-impor`.

## Apa yang diuji tiap kasus

| # | Kode | Pertanyaan yang dijawab |
| --- | --- | --- |
| 01 | 01 | Apakah struktur XML dasar diterima? |
| 02 | 04 | Apakah DPP nilai lain 11/12 diterima? |
| 03 | 04 | Apakah banyak item, diskon, jumlah desimal, dan karakter `& < > "` diterima? |
| 04 | 04 | Bagaimana Coretax membulatkan DPP nilai lain dan PPN? |
| 05 | 07 | Apakah keterangan tambahan, cap fasilitas, dan dokumen pendukung diterima? Apakah PPN `tarif x DPP nilai lain` diterima untuk fasilitas "tidak dipungut"? |
| 06 | 08 | Sama dengan 05 untuk fasilitas "dibebaskan" |
| 07 | 04 | Apakah pembeli NIK diterima? |
| 08 | 06 | Apakah pembeli paspor dan negara selain Indonesia diterima? |
| 09 | 04 | Apakah PPnBM dihitung dari DPP nilai lain seperti yang dikirim? |
| 10 | 09 | Apakah angka desimal untuk penyerahan aktiva diterima? |

## Pertanyaan terbuka yang dijawab uji ini

- Apakah Coretax menerima XML tanpa `xsi:noNamespaceSchemaLocation` (bentuk keluaran converter) dan dengan atribut itu (bentuk sampel DJP)? File dari skrip ini memakai bentuk sampel.
- Aturan pembulatan DPP nilai lain dan PPN di Coretax (kasus 04). Converter DJP membulatkan setengah ke genap, library setengah ke atas.
- Apakah PPN pada faktur kode 07 dan 08 harus 0 atau boleh `tarif x DPP nilai lain` (kasus 05 dan 06).
- Apakah faktur dengan pembeli sama dengan penjual diterima.
