# coretax-xml

[![CI](https://github.com/cuikww/coretax-xml/actions/workflows/ci.yml/badge.svg)](https://github.com/cuikww/coretax-xml/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

**Buat dan validasi file XML impor Coretax DJP langsung dari data aplikasi**, tanpa template Excel dan aplikasi converter. Pesan error per faktur dan per field dalam Bahasa Indonesia.

> **Status: v0.1 pra-rilis.** Urutan elemen dan tabel referensi sudah dicocokkan dengan paket resmi DJP (converter v1.6, template v1.6.1), tetapi **belum** dibandingkan dengan output converter resmi maupun diuji impor di Coretax sungguhan. DJP tidak menerbitkan file XSD. Jangan dipakai untuk produksi sebelum Gerbang 1 di [roadmap](docs/PRD.md#roadmap) lolos.

*English: a TypeScript library that builds and validates Indonesian DJP Coretax XML import files (tax invoices) from application data, with field-level error messages. Indonesian-first; English messages via `bahasa: 'en'`.*

- **Faktur pajak keluaran** (root `TaxInvoiceBulk`). Retur dan bukti potong menyusul.
- **Hitung otomatis**: DPP, DPP nilai lain 11/12, PPN, PPnBM, dengan aritmetika sen (`BigInt`), bukan floating point.
- **Validasi lengkap sekaligus**: format, kode referensi, aturan antar-field, dan hitungan. Semua error dikembalikan, tidak berhenti di yang pertama.
- **Skema berversi**: setiap versi template DJP menjadi skema sendiri yang tidak pernah diubah.
- **Privasi**: tanpa panggilan jaringan (diuji di CI), NPWP/NIK disamarkan di pesan error.
- **Tanpa dependensi runtime.** Node.js 20+, Bun, Deno, browser.

## Instalasi

```sh
npm install coretax-xml
```

Belum terbit di npm. Untuk mencoba sekarang, clone repo ini lalu jalankan `pnpm install && pnpm build`.

## Pemakaian

```ts
import { CoretaxValidationError, fakturKeluaran } from 'coretax-xml'

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
      item: [
        { jenis: 'jasa', nama: 'Jasa Konsultasi Sistem', satuan: 'UM.0033', harga: 600000, jumlah: 2 },
      ],
    },
  ],
} as const

// Validasi saja
const hasil = fakturKeluaran.validate(batch)
if (!hasil.valid) console.table(hasil.errors.map((e) => ({ faktur: e.faktur, field: e.field, pesan: e.pesan })))

// Buat XML (melempar CoretaxValidationError jika ada error)
try {
  const xml = fakturKeluaran.build(batch)
} catch (e) {
  if (e instanceof CoretaxValidationError) console.error(e.hasil.errors)
}
```

Untuk contoh di atas, library menghitung DPP 1.200.000, DPP nilai lain 1.100.000 (11/12, karena kode transaksi 04), dan PPN 132.000 (12%).

### Contoh error

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

### Opsi

| Opsi | Nilai | Default |
| --- | --- | --- |
| `schema` | `'auto'` (pilih dari tanggal faktur) atau id skema, mis. `'2025.09'` | `'auto'` |
| `hitung` | `'otomatis'` (DPP/PPN kosong dihitung) atau `'strict'` (semua angka wajib diisi, library hanya memeriksa) | `'otomatis'` |
| `bahasa` | `'id'` atau `'en'` | `'id'` |
| `samarkan` | Samarkan NPWP/NIK/NITKU di pesan error | `true` |

### Aturan hitung (v0.1)

| Nilai | Rumus |
| --- | --- |
| DPP (`TaxBase`) | harga x jumlah - diskon |
| DPP nilai lain (`OtherTaxBase`) | 11/12 x DPP untuk kode transaksi 04, selain itu sama dengan DPP; bisa diisi sendiri |
| PPN (`VAT`) | tarif (default 12%) x DPP nilai lain |
| PPnBM (`STLG`) | tarif PPnBM x DPP nilai lain (rumus template DJP v1.6.1); nilai lain yang diisi sendiri hanya diberi peringatan |
| Pembulatan | ke 2 desimal, setengah ke atas, per item |

Aturan pembulatan resmi DJP masih perlu dikonfirmasi (lihat [pertanyaan terbuka](docs/PRD.md#risiko--pertanyaan-terbuka)).

### Nama field berbahasa Inggris

Semua fungsi faktur keluaran (`validate`, `build`, `analisis`, `buildStream`) menerima nama Indonesia atau Inggris, bahkan dicampur per objek:

```ts
fakturKeluaran.build({
  seller: { tin: '0000000000000000', idtku: '0000000000000000000000' },
  invoices: [
    {
      date: '2026-10-01',
      transactionCode: '04',
      buyer: { idType: 'TIN', tin: '…', idtku: '…', name: 'PT Contoh', address: 'Jl. Contoh' },
      items: [{ type: 'service', name: 'Jasa', unit: 'UM.0033', price: 600000, quantity: 2 }],
    },
  ],
})
```

Dengan `bahasa: 'en'`, path field di hasil validasi juga berbahasa Inggris (`buyer.name`, `items[0].price`). Nama padanannya: `pembeli`/`buyer`, `item`/`items`, `npwp`/`tin`, `nitku`/`idtku`, `nama`/`name`, `alamat`/`address`, `harga`/`price`, `jumlah`/`quantity`, `dpp`/`taxBase`, `ppn`/`vat`, `jenis: 'barang'|'jasa'`/`type: 'goods'|'service'`, dan seterusnya (lihat tipe `BatchFakturKeluaranEn`). Retur masukan juga punya alias Inggris (`buyer`, `returns`, `invoiceNumber`, `returnQuantity`, ...; lihat `BatchReturFakturMasukanEn`).

### Data besar: streaming dan pemecahan file

```ts
for await (const file of fakturKeluaran.buildStream(
  { penjual, faktur: bacaFakturDariDatabase() }, // array, generator, atau stream
  { maksPerFile: 1000 },
)) {
  await simpan(file.nama, file.isi) // faktur-keluaran-0001.xml, -0002.xml, ...
}
```

Faktur dibaca satu per satu dan hanya satu file yang ditahan di memori. Nomor faktur di pesan error tetap nomor dalam seluruh sumber. Batas jumlah faktur per impor di Coretax belum diketahui; 1000 hanyalah angka aman.

### Retur faktur pajak masukan

```ts
import { returMasukan } from 'coretax-xml'

const xml = returMasukan.build({
  pembeli: { npwp: '0000000000000000' }, // pelapor retur (TIN)
  retur: [
    {
      nomorFaktur: '04002500000348920', // 17 digit
      npwpPenjual: '0000000000000000',
      tanggal: '2025-02-27',
      item: [
        { jenis: 'barang', nama: 'Barang', satuan: 'UM.0033', jumlah: 1, harga: 10000, jumlahRetur: 1, ppn: 1100 },
      ],
    },
  ],
})
```

PPN retur **wajib diisi sendiri**: template retur DJP tidak punya kolom tarif, jadi library tidak bisa menghitungnya. Total dokumen dihitung dari item. Belum diuji impor di Coretax.

### Periksa XML yang sudah ada

```ts
const hasil = fakturKeluaran.check(xmlString) // { valid, errors, warnings }, mode strict
```

### CLI (untuk non-programmer)

```sh
coretax-xml convert penjualan.xlsx   # template Excel DJP atau CSV -> XML
coretax-xml check faktur.xml         # periksa XML (satu file atau folder)
```

Error menunjuk baris Excel, bukan baris XML. Lihat [packages/cli](packages/cli/README.md). Biner mandiri tanpa Node.js bisa dibuat dengan workflow *Biner CLI* (manual).

## Dokumentasi

- [PRD](docs/PRD.md): tujuan, cakupan, arsitektur, stack, roadmap
- [Keputusan teknis](docs/DECISIONS.md)
- [Panduan uji impor Coretax](docs/UJI-IMPOR.md) (untuk mitra PKP atau konsultan pajak)
- [Fixtures dan rencana golden file](fixtures/README.md) · [File resmi DJP](fixtures/djp/README.md)
- [Kontribusi](CONTRIBUTING.md) · [Keamanan dan privasi](SECURITY.md)

## Penafian

Library ini **bukan produk DJP** dan tidak berafiliasi dengan Direktorat Jenderal Pajak. **Bukan nasihat pajak.** Pengguna tetap bertanggung jawab atas kebenaran kode transaksi, tarif, dan isi faktur. XML yang lolos validasi library belum tentu diterima Coretax jika DJP mengubah aturan.

## Lisensi

[MIT](LICENSE)
