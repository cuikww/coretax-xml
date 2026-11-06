# Keputusan teknis

Keputusan selama implementasi, pelengkap [PRD](PRD.md). Bagian terbaru di bawah.

## 2026-11-05: Setup awal dan v0.1 (draf)

**Nama paket.** `coretax-xml` dan `coretax` belum terpakai di npm dan PyPI (dicek 2026-11-05). Core diterbitkan tanpa scope sebagai `coretax-xml`; paket tambahan nanti memakai scope `@coretax-xml/` (org npm perlu didaftarkan).

**Build pakai tsup, bukan tsdown.** PRD menyebut tsdown. Dipilih tsup ^8.5 supaya sama dengan repo `nusawilayah` milik maintainer: satu alat build di semua proyek, konfigurasi sudah teruji. Bisa diganti nanti tanpa mengubah API.

**Versi toolchain mengikuti nusawilayah.** pnpm 11, TypeScript ^5.9, Vitest ^3.2, Turborepo ^2.5, Changesets. Ditambah Biome untuk lint dan format.

**Struktur XML dari sumber sekunder.** Urutan dan nama elemen diambil dari sampel yang dikutip Sipajak (template v1.4 / Excel v1.6.1) dan dicocokkan dengan nama elemen di skrip Zoho Books (raw-dani). Halaman resmi DJP belum dibuka langsung. Karena itu `meta.terverifikasiDenganXsdResmi = false` dan README menandai v0.1 sebagai pra-rilis.

**Nama field input berbahasa Indonesia saja di v0.1.** PRD F1.1 menyebut alias Inggris (`buyer.tin`). Ditunda supaya API kecil dulu; tipe TypeScript sudah menjelaskan setiap field.

**Aritmetika sen dengan BigInt.** Semua angka disimpan sebagai sen (1/100). `keSen()` menolak lebih dari 2 desimal, koma desimal, dan pemisah ribuan (`'1.000.000'`), karena salah tafsir pemisah adalah sumber error yang umum.

**Pembulatan setengah ke atas, per item.** DPP nilai lain dan PPN dibulatkan ke sen per item. Aturan resmi (per item atau per faktur, ke rupiah atau ke sen) belum dikonfirmasi dan tercatat di pertanyaan terbuka PRD.

**DPP nilai lain default.** 11/12 x DPP untuk kode transaksi 04 (sesuai contoh PMK 131/2024 di sumber), selain itu sama dengan DPP. Pengguna bisa mengisi `dppNilaiLain` sendiri. Library tidak menentukan kode transaksi mana yang benar untuk transaksi pengguna.

**PPN yang diisi pengguna hanya diperiksa untuk kode 01, 04, 09.** Untuk kode lain (mis. besaran tertentu), nilai yang diisi pengguna dipakai apa adanya.

**Pembeli non-TIN.** `BuyerTin` diisi 16 nol, `BuyerIDTKU` = `000000`, nomor dokumen wajib. NPWP yang diisi untuk jenis ID selain TIN menghasilkan peringatan dan diabaikan.

**`IND` hanya peringatan.** Sampel resmi lama memakai `IND`, padahal referensi terbaru menjadikan `IND` = India. Dibuat peringatan, bukan error, sampai ada konfirmasi dari XSD.

**Tabel referensi belum lengkap.** Satuan UM.0001 sampai UM.0039 ada sebagai kode; nama satuan hanya untuk UM.0034 sampai UM.0039 (dari pengumuman DJP). Keterangan tambahan dan cap fasilitas diperiksa dengan pola `TD.005xx` dan `TD.011xx`, belum dengan daftar lengkap.

**Validasi XSD, CLI, streaming, dan `check()` belum ada.** Sesuai roadmap: CLI di v0.2, paket XSD di v0.3. `check()` untuk XML buatan pihak lain menyusul setelah XSD resmi tersedia.

**Test privasi.** `test/privasi.test.ts` gagal jika file di `src/` memakai `fetch`, `XMLHttpRequest`, WebSocket, atau modul `http`, `net`, `fs`, `child_process`.

## 2026-11-05: Paket resmi DJP

**Sumber utama sekarang paket resmi.** `ConverterEfakturCoretax__v1.6.zip` dan sampel XML diunduh dari halaman DJP; hash dan isinya dicatat di `fixtures/djp/README.md`. Sampel XML disimpan apa adanya (`-text` di `.gitattributes`). Exe dan template Excel tidak disimpan di repo karena izin redistribusi belum jelas.

**Tidak ada XSD.** Halaman DJP hanya merujuk `TaxInvoice.xsd` di atribut XML; filenya tidak diterbitkan. `meta.terverifikasiDenganXsdResmi` tetap `false`.

**Tabel referensi dari sheet REF template v1.6.1.** Satuan (39, lengkap dengan nama), kode transaksi, keterangan tambahan dan cap fasilitas per kode 07 (31 kode) dan 08 (10 kode), serta 238 kode negara. Validasi pola `TD.005xx`/`TD.011xx` dan `[A-Z]{3}` diganti dengan pengecekan ke daftar. Kode error berganti nama: `ADDINFO_FORMAT` → `ADDINFO_UNKNOWN`, `FACILITY_FORMAT` → `FACILITY_UNKNOWN`, `COUNTRY_FORMAT` → `COUNTRY_UNKNOWN` (belum ada rilis, jadi tidak dianggap breaking). Untuk kode transaksi selain 07/08 yang mengisi keterangan tambahan atau cap fasilitas, dicek ke daftar 07 (paling lengkap). Nama negara disalin apa adanya, termasuk salah DJP (`AIA` tertulis "Angola").

**`IND` tetap peringatan.** Daftar resmi mengonfirmasi `IND` = India dan `IDN` = Indonesia. Sampel XML resmi v1.4 masih memakai `IND` untuk pembeli NPWP Indonesia, jadi tetap peringatan, bukan error.

**PPnBM = tarif PPnBM x DPP nilai lain, selisih hanya peringatan.** Mengikuti rumus di sheet `DetailFaktur` template (`=M2*J2/100`) dan keterangan "bisa diisi dengan nilai lain". Sebelumnya dihitung dari DPP dan selisih dianggap error.

**Sampel resmi v1.4 jadi test.** `build` menghasilkan elemen dan nilai yang sama dengan `Sample Faktur PK Template v.1.4.xml`, kecuali `BuyerDocumentNumber`, `BuyerName`, `BuyerAdress` yang dikosongkan sampel lama tetapi diwajibkan template v1.6.1 (`-` untuk pembeli TIN, nama dan alamat wajib). Indentasi tidak dibandingkan: sampel memakai tab, library 2 spasi.

**Converter tidak bisa dijalankan otomatis.** Converter adalah aplikasi WinForms .NET tanpa mode baris perintah. Golden file harus dibuat manual: isi template Excel, jalankan converter, simpan XML-nya. String di exe menyebut `Round` (pembulatan .NET default adalah ke genap, bukan setengah ke atas) dan `xsi:nil="true"`; keduanya baru bisa dipastikan dari golden file.

## 2026-11-06: Kasus uji golden file

**Satu file Excel, 10 faktur.** Converter menghasilkan satu XML per file Excel, jadi golden file-nya satu XML berisi 10 faktur (`kasus.converter.xml`), bukan 10 file. Kasus dan alasannya ada di `fixtures/faktur-keluaran/golden/README.md`.

**Excel dibuat dari template resmi, bukan dari nol.** `buat-xlsx.mjs` hanya mengganti isi sheet `Faktur` dan `DetailFaktur` di template v1.6.1 (nama sheet, kolom, dan sheet REF utuh) supaya yang dibaca converter sama dengan yang dibaca pengguna. Skrip tidak menghitung: semua angka berasal dari `kasus.json` yang diperiksa library di mode strict. File xlsx tidak masuk git (turunan template DJP).

**Probe pembulatan terpisah.** `probe-pembulatan.json` berisi angka 3 desimal yang sengaja tidak sah untuk library; hanya untuk melihat apakah converter membulatkan ke genap atau setengah ke atas, memotong, atau menolak.

**Test pembanding otomatis aktif.** `golden.test.ts` melewati perbandingan sampai `kasus.converter.xml` ada. Perbandingan mengabaikan indentasi, header XML, dan beda penulisan elemen kosong (`<X/>` vs `xsi:nil`); semua nilai dan urutan elemen dibandingkan.
