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
