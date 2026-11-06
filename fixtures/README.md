# Fixtures

File acuan untuk test. Setiap file XML di sini dibandingkan byte per byte dengan output library.

| File                                      | Asal                                                                                                                                                                  | Status                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `faktur-keluaran/contoh-jasa-kode-04.xml` | Disusun ulang dari sampel yang dikutip [Sipajak](https://www.sipajak.com/post/format-xml-faktur-pajak-coretax) (template v1.4 / Excel v1.6.1), nilai NPWP diganti nol | Sumber sekunder, **belum** dibandingkan dengan converter resmi DJP |

## Rencana golden file (Gerbang 1, lihat `docs/PRD.md`)

1. ~~Unduh paket template dan converter dari halaman resmi DJP~~ Selesai 2026-11-05, lihat [`djp/README.md`](djp/README.md).
2. ~~Isi template Excel dengan kasus uji~~ Disiapkan di [`faktur-keluaran/golden/`](faktur-keluaran/golden/README.md): 10 kasus dan 1 probe pembulatan.
3. Ubah dengan converter resmi, simpan XML-nya di `faktur-keluaran/golden/`.
4. Simpan input yang sama sebagai JSON di sebelahnya, lalu tambahkan test yang membandingkan keduanya.
5. File yang sudah lolos impor di Coretax sungguhan diberi akhiran `.lolos-coretax.xml`.

**Jangan pernah menyimpan NPWP, NIK, atau nama asli** di folder ini. Pakai nomor nol atau nomor rekaan.
