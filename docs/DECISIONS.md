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

## 2026-11-06: Hasil converter resmi (kasus.converter.xml)

**Output library sama dengan converter resmi untuk 10 kasus**: nilai, urutan elemen, elemen kosong `<X/>` (converter tidak memakai `xsi:nil`), angka tanpa pemisah ribuan, `10.5` dan `14500.5` tanpa nol di belakang, dan karakter `&`, `<`, `>`.

**Beda yang diperbaiki: tanda kutip.** Converter menulis `"` dan `'` apa adanya di isi elemen (hanya `& < >` di-escape). Library sebelumnya menulis `&quot;` dan `&apos;`. Keduanya XML valid; disamakan dengan converter.

**Beda yang dibiarkan (tidak memengaruhi isi):** converter menulis BOM UTF-8, CRLF, dan root `<TaxInvoiceBulk xmlns:xsd=... xmlns:xsi=...>` tanpa `xsi:noNamespaceSchemaLocation`. Sampel resmi v1.4 memakai tab dan menyertakan `noNamespaceSchemaLocation="TaxInvoice.xsd"`. Library mengikuti sampel. Mana yang diterima Coretax baru bisa dipastikan lewat uji impor nyata; kedua bentuk berasal dari DJP.

**Pelajaran penting:** converter DJP tidak menghitung apa pun. Semua angka disalin dari sel Excel. Aturan hitung (11/12, pembulatan) sepenuhnya tanggung jawab pengisi template, jadi golden file ini tidak bisa membuktikan benar-tidaknya rumus, hanya format penulisan. Kebenaran rumus tetap perlu uji impor nyata dan reviewer pajak.

## 2026-11-06: Probe pembulatan converter

Hasil `probe-pembulatan.converter.xml` (angka 3 desimal diisi di semua kolom angka): 0,005 → 0 · 0,015 → 0,02 · 0,025 → 0,02 · 0,035 → 0,04 · 2,675 → 2,68 · 100,125 → 100,12. Converter **menerima** angka lebih dari 2 desimal dan membulatkannya **setengah ke genap** (banker's rounding, `Math.Round` .NET), di semua kolom, tanpa peringatan.

**Keputusan: library tidak berubah.** Library menolak input lebih dari 2 desimal (`NUMBER_DECIMALS`) dan membulatkan hasil hitungan setengah ke atas. Converter hanya membulatkan angka yang sudah diisi pengguna di Excel; DJP tidak menerbitkan aturan pembulatan untuk DPP nilai lain dan PPN. Beda dengan setengah ke atas hanya muncul pada hasil yang tepat di .xx5 dan digit sebelumnya genap (mis. 0,045: genap 0,04 · atas 0,05). Untuk tarif 12% hasil seperti itu tidak mungkin muncul dari angka 2 desimal; untuk tarif lain (mis. 11%, PPnBM) bisa. Aturan yang berlaku di server Coretax hanya bisa dipastikan lewat uji impor nyata.

## 2026-11-06: CI dan gerbang rilis

**CI gagal sejak commit pertama.** Matriks Node 20/22/24 memakai pnpm 11 yang butuh Node >= 22.13, jadi `setup-node` (yang memanggil pnpm untuk cache) gagal di Node 20 dan membatalkan job lain. Sekarang: job `check` (lint, build, typecheck, test, smoke paket) di Node 24; job `node-lama` memasang dan membangun di Node 24 lalu menjalankan vitest langsung di Node 20 dan 22, karena `engines` paket menjanjikan Node >= 20.

**Smoke test paket.** `scripts/smoke-paket.mjs` mem-pack paket, memasangnya di folder kosong, dan memakainya lewat ESM dan CJS. Menangkap salah `files`/`exports` yang tidak terlihat oleh test di `src/`.

**Rilis npm dikunci sampai Gerbang 1.** `release.yml` sebelumnya berjalan di setiap push ke `main` dan, tanpa changeset, langsung `changeset publish`. Artinya 0.1.0 akan terbit begitu Trusted Publisher diaktifkan, padahal belum lolos uji impor. Sekarang job rilis hanya jalan jika variabel repo `RILIS_NPM` = `true`. Variabel itu diset manual setelah Gerbang 1 lolos dan Trusted Publisher untuk `coretax-xml` diaktifkan di npmjs.com. Saat diperiksa 2026-11-06, `coretax-xml` belum ada di npm (404), jadi tidak ada yang sempat terbit.
