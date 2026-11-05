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
