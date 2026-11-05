# Fixtures

File acuan untuk test. Setiap file XML di sini dibandingkan byte per byte dengan output library.

| File                                      | Asal                                                                                                                                                                  | Status                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `faktur-keluaran/contoh-jasa-kode-04.xml` | Disusun ulang dari sampel yang dikutip [Sipajak](https://www.sipajak.com/post/format-xml-faktur-pajak-coretax) (template v1.4 / Excel v1.6.1), nilai NPWP diganti nol | Sumber sekunder, **belum** dibandingkan dengan converter resmi DJP |

## Rencana golden file (Gerbang 1, lihat `docs/PRD.md`)

1. Unduh paket template dan converter dari [halaman resmi DJP](https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml), catat tanggal unduh dan versi di `djp/README.md`.
2. Isi template Excel dengan kasus uji (kode 01, 04, 07; pembeli TIN dan National ID; banyak item; diskon).
3. Ubah dengan converter resmi, simpan XML-nya di `faktur-keluaran/golden/`.
4. Simpan input yang sama sebagai JSON di sebelahnya, lalu tambahkan test yang membandingkan keduanya.
5. File yang sudah lolos impor di Coretax sungguhan diberi akhiran `.lolos-coretax.xml`.

**Jangan pernah menyimpan NPWP, NIK, atau nama asli** di folder ini. Pakai nomor nol atau nomor rekaan.
