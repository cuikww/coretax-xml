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

## 2026-11-06: v0.2 dimulai sebelum Gerbang 1 lolos

PRD menyatakan tidak ada jenis dokumen baru sebelum Gerbang 1 (impor Coretax nyata). Maintainer memutuskan memulai v0.2. Yang dikerjakan tidak menambah jenis dokumen baru (CLI dan `check()` memakai faktur keluaran), dan rilis ke npm tetap terkunci oleh `RILIS_NPM`. Retur faktur masukan, yang adalah jenis dokumen baru, dikerjakan setelah ini dan ditandai belum teruji impor.

**`check()` di core, bukan di CLI.** Memeriksa XML yang sudah ada adalah kebutuhan library (F3.6), bukan hanya CLI. Pembaca XML ditulis sendiri (± 80 baris, tanpa dependensi) karena struktur DJP tetap. Struktur diperiksa (akar, elemen wajib, elemen asing, urutan, `SellerIDTKU` konsisten), lalu isinya lewat jalur validasi yang sama dengan mode strict.

**Pembaca Excel: `fflate` + pembaca sel sendiri, bukan `exceljs`.** PRD memilih `exceljs`; ia membawa banyak paket turunan (archiver, unzipper, uuid, ...) dan rilis terakhirnya Desember 2024. CLI hanya butuh nilai sel. `fflate` (MIT, tanpa dependensi turunan) membuka zip, `xlsx.ts` (± 90 baris) membaca string bersama, sel angka, dan nilai tersimpan dari sel berumus. Pembaca tetap terpisah di `xlsx.ts` sehingga bisa diganti tanpa menyentuh yang lain.

**Argumen CLI: `node:util parseArgs`, bukan `citty`.** Empat perintah dan enam opsi; stdlib cukup. Tambahkan pustaka jika perintahnya bertambah banyak.

**Angka dari Excel dibaca sebagai teks.** Sel angka dikembalikan persis seperti tertulis di file (`504166.66666666669`), tidak lewat `Number`, supaya NPWP/NITKU numerik dan angka besar tidak rusak. Pembulatan ke 2 desimal memakai setengah ke genap seperti converter DJP (hasil probe), hanya untuk nilai yang datang dari Excel. Hitungan library sendiri tetap setengah ke atas; selisihnya hanya mungkin pada hasil yang tepat di .xx5.

**Default `--hitung` bergantung sumber.** Excel DJP: `strict`, karena angka di template adalah kebenaran bagi pengisinya dan library hanya mencocokkan. CSV: `otomatis`, karena pengguna CSV hanya mengisi harga dan jumlah. Jika rumus Excel dan hitungan library berbeda 0,01 pada kode 01/04/09, `convert` menolak dengan `VAT_MISMATCH`; `--hitung otomatis` menjadi jalan keluarnya. Perlu dikonfirmasi dari pengguna nyata apakah ini terlalu ketat.

**Error menunjuk baris sumber.** `Sumber` mencatat nomor baris Excel/CSV untuk setiap faktur dan item; laporan menulis `Faktur ke-2 (baris Excel 5), item 1 (baris Excel 3)`. Ini jawaban atas keluhan pesan error converter DJP yang merujuk baris XML.

**Biner CLI.** `bun build --compile` berhasil di Windows (± 96 MB karena menyertakan runtime Bun). Workflow `biner.yml` membangun 4 platform tetapi hanya dijalankan manual dan belum dicoba di GitHub Actions. Versi dibaca dari `package.json` lewat impor JSON supaya ikut ter-bundle.

**Diuji dengan file asli.** `convert` pada `kasus.xlsx` (dibuat dari template DJP asli) menghasilkan XML yang sama dengan converter resmi (test lokal, dilewati di CI karena file Excel tidak ada di repo). Template DJP asli dengan rumus juga berhasil dibaca.

## 2026-11-06: Retur faktur pajak masukan

**Sumber.** `Sample Retur Faktur PM Template v.1.1.xml` dan template Excel `Sample Retur Faktur PM Template v.1.1.xlsx` dari paket DJP v1.6. Akar `InputTaxInvoiceReturn`; per retur: `TransactionDocumentData`, lalu `TransactionDetailsData` berisi `Rows` (satu per barang) dan `FooterRow`. Skema `retur-masukan@2025.03`, terpisah dari faktur keluaran.

**PPN retur tidak dihitung.** Tidak ada kolom tarif di template retur (rumus contoh di Excel memakai 11% tetap), dan tarif yang berlaku mengikuti faktur asal yang tidak dilihat library. Jadi `ppn` wajib diisi pengguna. DPP dihitung (jumlah retur x harga - diskon) dan total dokumen dijumlah dari item bila kosong.

**Error hanya untuk aturan yang tertulis jelas.** Error: nomor faktur 17 digit, NPWP 16 digit, tanggal, satuan, jumlah retur tidak boleh melebihi jumlah faktur asal atau nol, DPP lain harus sama dengan DPP jika flag DPP lain = tidak (sheet Keterangan: "isikan dengan nilai yang sama dengan DPP Retur jika Flag DPP Lain bernilai Tidak"), FooterRow harus sama dengan nilai dokumen (Keterangan: "Diisi sama dengan ..."). **Peringatan** saja untuk yang tersirat: DPP berbeda dari jumlah retur x harga - diskon (rumus di template Excel `=H2*G2` tidak mengurangi diskon, jadi aturan sebenarnya tidak jelas) dan total dokumen berbeda dari jumlah item.

**Satuan retur memakai daftar faktur (UM.0001 sampai UM.0039).** Sheet REF template retur berhenti di UM.0033, tetapi retur harus memakai satuan yang sama dengan faktur asal, yang bisa UM.0034 ke atas.

**Format.** Tanggal ditulis `DD-MM-YYYY` (sampel dan string converter `dd-MM-yyyy`), berbeda dari faktur keluaran (`YYYY-MM-DD`); di `check()`, tanggal ISO ditolak dengan `RETUR_DATE_FORMAT`. `ReturnOtherTaxBaseCheck` ditulis `true`/`false`. Deklarasi XML `encoding="UTF-8"` mengikuti sampel retur (faktur keluaran memakai `utf-8` seperti output converter).

**Dalam hasil validasi retur, `faktur` berarti nomor retur** (retur ke-n); laporan CLI menulis "Retur ke-n".

**Refaktor bersama.** `periksaElemen` dan `pengumpulXml` dipakai faktur dan retur. Pemeriksa urutan menganggap elemen yang berulang berurutan (`<Rows>` banyak kali) sebagai satu; bug ini ketahuan oleh sampel retur resmi. `XML_ROOT` kini menyebut akar yang diharapkan.

**Belum.** Golden file dari converter DJP untuk retur (CLI sudah membaca template retur, tetapi XML-nya baru dibandingkan dengan sampel resmi satu kasus), CSV untuk retur, dan uji impor Coretax. Sampai golden file ada, perlakukan keluaran retur sebagai kandidat, bukan terbukti.

## 2026-11-06: Golden file retur: total dokumen dalam rupiah utuh

`kasus.converter.xml` (3 retur) dari converter DJP sama dengan output library untuk semua nilai per baris, kecuali satu hal yang ketahuan hanya oleh golden file: **converter menulis total dokumen (`ReturnTaxBase`, `ReturnOtherTaxBase`, `ReturnVAT`, `ReturnSTLG`) dan seluruh `FooterRow` dalam rupiah utuh**. Contoh: 572916,67 menjadi 572917, 36251,25 menjadi 36251, 4350,15 menjadi 4350. Nilai di dalam `Rows` tetap berdesimal (504166.67, 36251.25, 4350.15). Library sebelumnya menulis dua desimal di semua tempat.

**Perbaikan.** `bulatRupiahGenap()` di `money.ts`, dipakai penulis XML retur untuk total dokumen dan footer. Peringatan `RETUR_TOTAL_MISMATCH` tidak lagi muncul jika total yang diisi sama dengan jumlah item yang dibulatkan (kolom Total di Excel DJP berisi rupiah utuh). Analisis internal (`analisis().retur[].dpp`) tetap menyimpan jumlah persis.

**Asumsi yang belum terbukti: setengah ke genap pada nilai persis .5.** Data golden tidak memuat nilai persis .5, jadi aturan itu hanya mengikuti pembulatan converter pada angka faktur. `probe-pembulatan.json` (dua retur dengan total x,5) disiapkan untuk menjawabnya; testnya aktif begitu `probe-pembulatan.converter.xml` ada.

**CLI.** `convert retur.xlsx` menghasilkan XML yang sama dengan converter DJP untuk 3 retur (test lokal, dilewati di CI karena file Excel tidak ada di repo).

**Pelajaran.** Perbandingan satu sampel resmi tidak cukup: sampel retur v1.1 hanya berisi angka bulat, jadi aturan rupiah utuh tidak terlihat sampai ada kasus berdesimal. Ini alasan golden file faktur dan retur dengan angka desimal tetap perlu, dan alasan tidak menganggap output kandidat sebagai terbukti.

## 2026-11-07: Probe pembulatan total retur terjawab

`probe-pembulatan.converter.xml` (2 retur dengan total persis x,5) menunjukkan converter membulatkan total dokumen dan FooterRow **setengah ke genap**: 100,5 → 100; 102,5 → 102; 0,5 → 0; 101,5 → 102; 103,5 → 104; 1,5 → 2. Nilai per baris tetap apa adanya (100.5, 102.5, 0.5). Sama dengan asumsi `bulatRupiahGenap()` dan dengan pembulatan converter pada angka faktur, jadi library tidak berubah. Dua aturan pembulatan converter yang kini terbukti: angka masukan Excel dibulatkan ke 2 desimal setengah ke genap (faktur dan retur), dan total dokumen retur dibulatkan ke rupiah utuh setengah ke genap. Aturan di server Coretax tetap belum diketahui sampai uji impor nyata.

## 2026-11-07: Pemantau halaman template DJP

**Cara kerja.** `tools/watch-djp/watch.mjs` (Node saja, tanpa dependensi) mengambil halaman template DJP, mengambil semua tautan berkas (zip, xlsx, xml, pdf, ...), mengunduh tiap berkas dan menghitung SHA-256, lalu membandingkannya dengan `tools/watch-djp/state.json`. Workflow `pantau-djp.yml` berjalan tiap Senin dan bisa dijalankan manual; jika ada berkas yang isinya berubah, bertambah, atau hilang, ia membuka issue berlabel `format-djp` berisi tabel perbedaan dan daftar tindakan, lalu menyimpan state baru. Baseline pertama: 60 berkas (2026-11-07).

**Dijaga supaya tidak berisik atau salah paham.** Hash yang gagal diunduh tidak dianggap perubahan (hash lama dipertahankan dan kegagalannya dilaporkan di issue jika ada perubahan lain). Jika halaman hanya menghasilkan kurang dari 10 tautan, skrip gagal keras: itu tanda halaman berubah bentuk atau diblokir, bukan "semua berkas dihapus". `state.json` hanya ditulis saat ada perubahan, jadi tidak ada commit kosong tiap minggu. Commit state memakai `GITHUB_TOKEN`, yang tidak memicu workflow lain.

**Identitas jujur.** Skrip memperkenalkan diri sebagai `Mozilla/5.0 (compatible; coretax-xml-pemantau)`, hanya membaca halaman dan berkas publik, dan tidak mengirim data apa pun. Server DJP sesekali mereset koneksi (terlihat 2 kali saat pengembangan, selalu berhasil pada percobaan ulang); skrip mencoba 3 kali dengan jeda. Jika suatu saat DJP memblokir klien ini atau IP GitHub Actions, workflow akan gagal secara kasat mata. Itu keputusan untuk pemelihara (mis. minta izin ke DJP atau pantau manual), bukan untuk diakali dengan menyamar sebagai browser.

**Yang tidak dilakukan.** Skrip tidak membaca isi berkas (mis. mengurai catatan rilis) dan tidak membuat skema baru; ia hanya memberi tahu. Memutuskan apakah perubahan memengaruhi format XML tetap pekerjaan manusia dalam target 7 hari yang tertulis di PRD.

## 2026-11-07: Streaming dan pemecahan file (F1.5, F1.6)

**`fakturKeluaran.buildStream(sumber, { maksPerFile, awalanNama })`** adalah generator asinkron yang menghasilkan `{ nama, isi, nomor, jumlahFaktur, nomorFakturAwal, peringatan }` per file. Sumber boleh array, generator, atau stream; hanya `maksPerFile` faktur (default 1000) yang ditahan sekaligus. Setiap file divalidasi dan dihitung sendiri-sendiri; satu file dengan `maksPerFile` besar menghasilkan isi yang sama persis seperti `build()`.

**Nomor error tetap global.** `analisis()` menerima parameter internal `offset` sehingga error di faktur ke-4 dari sumber tetap bernomor 4 walau ada di file kedua. File sebelum yang bermasalah sudah diserahkan ke pemanggil saat error dilempar (pemanggil memutuskan apakah file itu dipakai); itu sengaja, karena menahan semuanya sampai selesai menghilangkan manfaat streaming.

**Default 1000 bukan aturan DJP.** Batas faktur atau ukuran file per impor XML masih pertanyaan terbuka di PRD; panduan uji impor tidak memeriksanya. Sampai terjawab, pemakai yang punya ribuan faktur sebaiknya memecah sendiri ke angka yang terbukti diterima.

**CLI.** `convert --maks-per-file N` memecah faktur keluaran menjadi `<nama>-0001.xml`, `-0002.xml`, ... bila jumlah faktur melebihi N; jika tidak, tetap satu file bernama biasa. Retur menolak opsi ini (retur belum punya `buildStream`). Di JSON laporan, `keluaran` sekarang daftar nama file (sebelumnya satu string; belum ada rilis).

**Belum.** Pembacaan Excel/CSV di CLI tetap memuat seluruh berkas ke memori; streaming sungguhan dari sumber besar baru ada di API library.
