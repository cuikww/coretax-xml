# Contoh: endpoint Express yang mengembalikan XML Coretax

Tombol "Ekspor faktur Coretax" di aplikasi penjualan: data pesanan diubah menjadi XML faktur pajak keluaran yang siap diunggah ke Coretax, atau daftar error per field jika datanya belum lengkap.

```sh
npm install
npm start
```

| Endpoint | Isi |
| --- | --- |
| `GET /faktur.xml` | Semua pesanan di "database" contoh menjadi satu file XML (unduhan) |
| `POST /faktur/xml` | Kirim `{ "faktur": [...] }` dalam format input library; balasan XML, atau `422` dengan daftar error |
| `POST /faktur/validasi` | Hanya periksa; untuk menampilkan error di form sebelum ekspor |

```sh
curl -OJ http://localhost:3000/faktur.xml

# Data salah: NPWP pembeli kurang digit, satuan tidak dikenal
curl -s http://localhost:3000/faktur/xml -H 'content-type: application/json' -d '{
  "faktur": [{
    "tanggal": "2026-10-01", "kodeTransaksi": "04",
    "pembeli": { "jenisId": "TIN", "npwp": "123", "nitku": "0000000000000000000000", "nama": "PT A", "alamat": "Jl. A" },
    "item": [{ "jenis": "jasa", "nama": "Jasa", "satuan": "UM.9999", "harga": 600000, "jumlah": 2 }]
  }]
}'
```

Balasan `422` (dipotong):

```json
{
  "errors": [
    {
      "code": "NPWP_FORMAT",
      "faktur": 1,
      "field": "pembeli.npwp",
      "pesan": "NPWP pembeli harus 16 digit angka, ditemukan 3 karakter.",
      "saran": "Hapus titik, strip, dan spasi. NPWP 15 digit lama perlu diubah ke format 16 digit."
    },
    { "code": "UNIT_UNKNOWN", "faktur": 1, "item": 1, "field": "item[0].satuan", "pesan": "Satuan \"UM.9999\" tidak ada di skema 2025.09." }
  ]
}
```

Catatan untuk produksi:

- Data besar: pakai `fakturKeluaran.buildStream()` dan kirim beberapa file (atau zip), jangan satu string raksasa.
- Library tidak mengirim apa pun ke internet; NPWP di pesan error disamarkan secara default.
- XML yang lolos validasi belum tentu diterima Coretax. Bukan nasihat pajak.
