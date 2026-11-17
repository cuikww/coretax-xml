# File resmi DJP

Diunduh 2026-11-05 dari [Template XML dan Converter Excel ke XML](https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml). File XML di folder ini disimpan **tanpa diubah**. Nomor NPWP di dalamnya adalah nomor contoh dari DJP.

| File di folder ini | SHA-256 |
| --- | --- |
| `Sample Faktur PK Template v.1.4.xml` | `113f44079470f8d8a2e9199d05113934c02a055be087feecf5286db6f6576f0e` |
| `Sample Retur Faktur PM Template v.1.1.xml` | `8708925088f45f639ed842bd2a5a655c7a9f5f93417107dae2bcc62a365726f4` |
| `Sample Lampiran C Template v.1.1.xml` | `94944c1938ab6dbdaff0bb07820fee509790bd242d813fd170f54d66e71c55ab` |

File berikut **tidak** disimpan di repo (biner dan template Excel; izin redistribusi masih pertanyaan terbuka di PRD). Unduh dari URL-nya dan cocokkan hash-nya.

| File | URL | SHA-256 |
| --- | --- | --- |
| `ConverterEfakturCoretax__v1.6.zip` | https://pajak.go.id/sites/default/files/2026-01/ConverterEfakturCoretax__v1.6.zip | `ef5957af98ed06d7aee3c0fed6a67b56fe6f515bf776788194b2acd9a005b791` |
| ↳ `Converter.Efaktur.Coretax.exe` | (di dalam zip) | `d351b8e1f75fe994176aa21d58512365c1b279bc6cc81cb3da8b2d1b085d46f5` |
| ↳ `TemplateExcel/Sample Faktur PK Template v.1.6.1.xlsx` | (di dalam zip) | `22a415ff061d4cf44a6678fcd81b388732e6a9e05441aae88bbff36c78e3bf90` |
| ↳ `TemplateExcel/Sample Retur Faktur PM Template v.1.1.xlsx` | (di dalam zip) | `8cdb77d10e70cd7bd9a9e8149711279873178e11cdd9fe4ea32647ee4cc9e525` |
| `Sample Faktur PK Template v.1.4.xml.zip` | https://pajak.go.id/sites/default/files/2025-03/Sample%20Faktur%20PK%20Template%20v.1.4.xml.zip | `a71d6c004f7d0979b9f33eedc7f669daf3238e6820d2decd13525f2cc32b9beb` |
| `Sample Retur Faktur PM Template v.1.1.xml.zip` | https://pajak.go.id/sites/default/files/2025-03/Sample%20Retur%20Faktur%20PM%20Template%20v.1.1.xml.zip | `87ede35c832e794b14fa5c269c0fd2f06f4bd353c4f71c93c54a0d6c8c50b52e` |

## Isi paket converter v1.6

- Aplikasi Windows (.NET Framework 4.5, WinForms) dengan pilihan jenis XML: Faktur Pajak Keluaran, Retur Pajak Masukan, Lampiran C. Tidak ada mode baris perintah.
- Membaca sheet `Faktur` + `DetailFaktur` (retur: `Retur` + `DetailRetur`), berhenti di baris `END`.
- Tanggal faktur ditulis `yyyy-MM-dd`; tanggal retur `dd-MM-yyyy`.
- String di exe menyebut `Round` dan `xsi:nil="true"`: cara pembulatan dan penulisan elemen kosong oleh converter belum diketahui sampai golden file dibuat.
- Halaman DJP **tidak** menyediakan file XSD (`TaxInvoice.xsd` hanya dirujuk di atribut `xsi:noNamespaceSchemaLocation`).

## Bukti potong PPh 21 dan 26 (diunduh 2026-11-17)

| File di folder ini | SHA-256 |
| --- | --- |
| `bp21.xml` (isi `bp21.zip`) | `cad188273792429397d82ebe6a873f9a7bb785d110e01c5191f03545b5b82637` |
| `bp26.xml` (isi `bp26.zip`) | `a6e9137ed2a0bc6f5a0f58865b4618d7598c374a085fb0ba407d92e1fd310153` |

| File (tidak disimpan di repo) | URL | SHA-256 |
| --- | --- | --- |
| `bp21.zip` | https://pajak.go.id/sites/default/files/2024-12/bp21.zip | `0cda03753cf7c9985358ed68c302e86c53c88a4e7640db55bc8b5504a1aa6f12` |
| `bp26.zip` | https://pajak.go.id/sites/default/files/2024-12/bp26.zip | `fd4e052ef9a38ca0e3e261e241b642d4011f6bafe50e253fac07252e8d963759` |
| `BP21 Excel to XML v.4.xlsx` | https://pajak.go.id/sites/default/files/2025-04/BP21%20Excel%20to%20XML%20v.4.xlsx | `511bec3d57f61f2273112fdbae66b373be372df12c3ae13146d8373d1ca840cf` |
| `BP26 Excel to XML.xlsx` | https://pajak.go.id/sites/default/files/2024-12/BP26%20Excel%20to%20XML.xlsx | `26a1ccee4597d3d26cc357fb6567fd6f47509e2c6a9c0372f3898744ca658815` |

Isi yang penting:

- Kedua Excel memakai **XML Map** dengan skema XSD yang tertanam (`xl/xmlMaps.xml`). Itu satu-satunya XSD resmi yang ada untuk dokumen Coretax di repo ini; urutan elemen, tipe, dan elemen `nillable` diambil dari sana. XML dibuat lewat *Developer > Export*, bukan converter.
- Daftar jenis dokumen di XSD itu sudah usang (`Announchment`, `DeedofEngangement`), sedangkan sheet REF dan contoh data versi 4 memakai `Announcement`, `DeedOfEngagement`, `Decree`, `Other`, dan seterusnya. Library memakai daftar REF.
- Sheet DATA BP21 menghitung deemed (VLOOKUP ke REF) dan tarif (TER A/B/C, Pasal 17, harian, pesangon, pensiun) dengan rumus. Rumusnya disalin ke `fixtures/bupot/rumus-bp21.json`. BP26 tidak punya rumus.
- Rumus tarif menerima status PTKP `HB/0` sampai `HB/3`, tetapi XSD hanya menerima `TK/0`-`TK/3` dan `K/0`-`K/3`. Library mengikuti XSD.
