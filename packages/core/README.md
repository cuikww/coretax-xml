# @coretax-xml/core

[![npm core](https://img.shields.io/npm/v/@coretax-xml/core?label=%40coretax-xml%2Fcore)](https://www.npmjs.com/package/@coretax-xml/core) [![provenance](https://img.shields.io/badge/npm-provenance-blue)](https://docs.npmjs.com/generating-provenance-statements)

Buat dan validasi file XML impor **Coretax DJP** langsung dari data aplikasi, tanpa template Excel dan aplikasi converter. Pesan error per faktur dan per field dalam Bahasa Indonesia.

> **Pra-rilis (0.x).** Output sama dengan converter resmi DJP v1.6 untuk 10 kasus faktur dan 3 kasus retur, tetapi **belum** diuji impor di Coretax sungguhan. DJP tidak menerbitkan XSD. Bandingkan dulu dengan converter DJP sebelum dipakai untuk produksi.

*English: builds and validates Indonesian DJP Coretax XML import files (output tax invoices, input-invoice returns, PPh 21/26 withholding slips) from application data. English field names and messages are supported (`bahasa: 'en'`).*

## Untuk siapa

- **Developer** aplikasi penjualan, kasir, e-commerce, ERP, atau software akuntansi untuk Pengusaha Kena Pajak (PKP) yang ingin menambah tombol "Ekspor faktur Coretax".
- **Staf pajak dan konsultan** yang memegang file Excel atau CSV: pakai CLI [`@coretax-xml/cli`](https://www.npmjs.com/package/@coretax-xml/cli), tanpa menulis kode.

Contoh masalah yang diselesaikan:

- Di akhir bulan ada 300 penjualan ber-faktur di database. `fakturKeluaran.build()` mengubahnya menjadi XML siap unggah. Kalau datanya besar, `buildStream()` memecahnya per 1000 faktur.
- NPWP pembeli kurang satu digit, atau PPN tidak sesuai hitungan. `validate()` menunjuk faktur, item, dan field yang salah, beserta saran perbaikan, sebelum file diunggah.
- Ada XML buatan aplikasi lain yang ditolak Coretax. `check()` memeriksa struktur dan hitungannya.
- Barang pembelian dikembalikan ke penjual. `returMasukan.build()` membuat XML retur faktur pajak masukan.
- Penggajian bulanan untuk 200 karyawan. `bupot21.build()` membuat XML bukti potong PPh 21, dengan tarif TER dihitung dari status PTKP.

Yang **tidak** dilakukan: login atau unggah ke Coretax, menerbitkan nomor seri faktur, atau menentukan kode transaksi yang benar untuk transaksi Anda.

## Instalasi

```sh
npm install @coretax-xml/core
```

ESM dan CommonJS, dengan tipe TypeScript. Tanpa dependensi runtime. Node.js 20+, Bun, Deno, dan browser.

## Faktur pajak keluaran

```ts
import { CoretaxValidationError, fakturKeluaran } from '@coretax-xml/core'

const batch = {
  penjual: { npwp: '0000000000000000', nitku: '0000000000000000000000' },
  faktur: [
    {
      tanggal: '2026-10-01',
      kodeTransaksi: '04',
      referensi: 'INV-2026-10-001',
      pembeli: {
        jenisId: 'TIN',
        npwp: '0000000000000000',
        nitku: '0000000000000000000000',
        nama: 'PT Contoh Pembeli',
        alamat: 'Jl. Contoh No. 1, Jakarta',
      },
      item: [{ jenis: 'jasa', nama: 'Jasa Konsultasi', satuan: 'UM.0033', harga: 600000, jumlah: 2 }],
    },
  ],
} as const

const hasil = fakturKeluaran.validate(batch) // { valid, schema, errors, warnings }

try {
  const xml = fakturKeluaran.build(batch) // string XML, root TaxInvoiceBulk
} catch (e) {
  if (e instanceof CoretaxValidationError) console.error(e.hasil.errors)
}
```

Library menghitung DPP 1.200.000, DPP nilai lain 1.100.000 (11/12 untuk kode 04), dan PPN 132.000 (12%) dengan aritmetika sen (`BigInt`).

Contoh satu error:

```json
{
  "code": "BUYER_IDTKU_MISMATCH",
  "level": "error",
  "faktur": 3,
  "item": null,
  "field": "pembeli.nitku",
  "element": "BuyerIDTKU",
  "nilai": "0000**************0000",
  "pesan": "Jenis ID pembeli \"National ID\" harus memakai ID TKU \"000000\".",
  "saran": "Kosongkan pembeli.nitku (akan diisi \"000000\"), atau ubah jenisId ke \"TIN\" jika pembeli sudah terdaftar di Coretax."
}
```

Semua error dikembalikan sekaligus, dan NPWP/NIK disamarkan di pesan.

### Data besar

```ts
for await (const file of fakturKeluaran.buildStream(
  { penjual, faktur: bacaDariDatabase() }, // array, generator, atau async iterable
  { maksPerFile: 1000 },
)) {
  await simpan(file.nama, file.isi) // faktur-keluaran-0001.xml, -0002.xml, ...
}
```

### Periksa XML yang sudah ada

```ts
fakturKeluaran.check(xml) // atau returMasukan.check(xml)
```

## Retur faktur pajak masukan

```ts
import { returMasukan } from '@coretax-xml/core'

const xml = returMasukan.build({
  pembeli: { npwp: '0000000000000000' }, // pelapor retur
  retur: [
    {
      nomorFaktur: '04002500000348920',
      npwpPenjual: '0000000000000000',
      tanggal: '2025-02-27',
      item: [{ jenis: 'barang', nama: 'Barang', satuan: 'UM.0033', jumlah: 1, harga: 10000, jumlahRetur: 1, ppn: 1100 }],
    },
  ],
})
```

PPN retur wajib diisi sendiri, karena template retur DJP tidak punya kolom tarif. `returMasukan.buildStream()` juga tersedia.

## Bukti potong PPh 21 dan 26

```ts
import { bupot21 } from '@coretax-xml/core'

const xml = bupot21.build({
  pemotong: { npwp: '0000000000000000', nitku: '0000000000000000000000' },
  bupot: [
    {
      masa: 1,
      tahun: 2025,
      penerima: { npwp: '0000000000000000', statusPtkp: 'TK/0' }, // NIK/NPWP 16 digit
      kodeObjekPajak: '21-100-35',
      penghasilan: 10000000,
      // deemed dan tarif boleh dikosongkan: diisi seperti rumus template DJP (di sini TER A, 2%)
      jenisDokumen: 'PaymentProof',
      nomorDokumen: 'GAJI-2025-01',
      tanggalPemotongan: '2025-01-25',
    },
  ],
})
```

Deemed dari daftar kode objek pajak; tarif dihitung seperti rumus template "BP21 Excel to XML v.4" (TER A/B/C menurut status PTKP, Pasal 17, harian, pesangon, pensiun). Ini meniru template, bukan penghitungan PPh 21 lengkap: XML hanya memuat tarif, Coretax yang menghitung pajaknya. Tarif yang diisi sendiri dan berbeda dari rumus diberi peringatan, kecuali memakai fasilitas (SKB, SKD, lainnya). `bupot26` untuk penerima luar negeri (`penerima: { tin, nama, negara, ... }`). Skema diambil dari XSD yang tertanam di template Excel DJP.

## Opsi

| Opsi | Nilai | Default |
| --- | --- | --- |
| `schema` | `'auto'` (dipilih dari tanggal faktur) atau id skema, mis. `'2025.09'` | `'auto'` |
| `hitung` | `'otomatis'` (DPP/PPN kosong dihitung) atau `'strict'` (semua angka wajib diisi, library hanya memeriksa) | `'otomatis'` |
| `bahasa` | `'id'` atau `'en'` (pesan dan path field) | `'id'` |
| `samarkan` | Samarkan NPWP/NIK/NITKU di pesan error | `true` |

Nama field Inggris diterima di semua fungsi, juga dicampur: `seller`/`invoices`/`buyer`/`items`, dan untuk retur `buyer`/`returns`/`invoiceNumber`/`returnQuantity`. Lihat tipe `BatchFakturKeluaranEn` dan `BatchReturFakturMasukanEn`.

Lainnya: `referensi.*` untuk daftar kode (satuan, kode transaksi, negara) dan `katalogError()` untuk semua kode error.

## Penafian

Bukan produk DJP dan tidak berafiliasi dengan Direktorat Jenderal Pajak. Bukan nasihat pajak. XML yang lolos validasi belum tentu diterima Coretax jika DJP mengubah aturan. Semua proses berjalan lokal, tanpa panggilan jaringan.

Dokumentasi lengkap, aturan hitung, dan roadmap: [github.com/cuikww/coretax-xml](https://github.com/cuikww/coretax-xml#readme). Lisensi MIT.
