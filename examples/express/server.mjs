// Contoh: endpoint "Ekspor faktur Coretax" di aplikasi Express.
// Jalankan: npm install && npm start, lalu lihat README.md untuk contoh curl.
import { CoretaxValidationError, fakturKeluaran } from '@coretax-xml/core'
import express from 'express'

// Di aplikasi sungguhan: dari pengaturan perusahaan
const PENJUAL = { npwp: '0000000000000000', nitku: '0000000000000000000000' }

// Di aplikasi sungguhan: query ke database pesanan
const pesananDb = [
  {
    nomor: 'INV-2026-10-001',
    tanggal: '2026-10-01',
    pelanggan: {
      npwp: '0000000000000000',
      nitku: '0000000000000000000000',
      nama: 'PT Contoh Pembeli',
      alamat: 'Jl. Contoh No. 1, Jakarta',
    },
    baris: [{ nama: 'Jasa Konsultasi Sistem', harga: 600000, qty: 2 }],
  },
]

/** Ubah satu pesanan menjadi faktur untuk library. Kode transaksi 04 = DPP nilai lain 11/12. */
const keFaktur = (p) => ({
  tanggal: p.tanggal,
  kodeTransaksi: '04',
  referensi: p.nomor,
  pembeli: { jenisId: 'TIN', ...p.pelanggan },
  item: p.baris.map((b) => ({
    jenis: 'jasa',
    nama: b.nama,
    satuan: 'UM.0033',
    harga: b.harga,
    jumlah: b.qty,
  })),
})

const app = express()
app.use(express.json({ limit: '5mb' }))

// GET /faktur.xml : semua pesanan di "database" menjadi satu file XML siap unggah ke Coretax
app.get('/faktur.xml', (_req, res) => kirimXml(res, { penjual: PENJUAL, faktur: pesananDb.map(keFaktur) }))

// POST /faktur/xml : kirim batch sendiri (format input library), terima XML atau daftar error
app.post('/faktur/xml', (req, res) => kirimXml(res, { penjual: PENJUAL, faktur: req.body?.faktur }))

// POST /faktur/validasi : hanya periksa, untuk menampilkan error per field di form
app.post('/faktur/validasi', (req, res) => {
  res.json(fakturKeluaran.validate({ penjual: PENJUAL, faktur: req.body?.faktur }))
})

function kirimXml(res, batch) {
  try {
    const xml = fakturKeluaran.build(batch)
    res.type('application/xml').attachment('faktur-keluaran.xml').send(xml)
  } catch (e) {
    if (!(e instanceof CoretaxValidationError)) throw e
    // 422: data tidak valid. Setiap error punya nomor faktur, field, pesan, dan saran dalam Bahasa Indonesia.
    res.status(422).json({ errors: e.hasil.errors, warnings: e.hasil.warnings })
  }
}

const port = Number(process.env.PORT ?? 3000)
app.listen(port, () => console.log(`http://localhost:${port}/faktur.xml`))
