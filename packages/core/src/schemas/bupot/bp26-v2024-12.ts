/**
 * Skema bukti potong PPh 26, versi 2024.12 (root XML `BP26Bulk`).
 *
 * Dasar: "BP26 Excel to XML.xlsx" (https://pajak.go.id/sites/default/files/2024-12/BP26%20Excel%20to%20XML.xlsx) dan sampel bp26.zip dari halaman resmi DJP (diunduh 2026-11-17).
 * Urutan elemen dan tipe dari XSD yang tertanam di Excel (XML Map); daftar kode dari sheet REF. Daftar jenis
 * dokumen di XSD itu sudah usang (mis. "Announchment"), jadi dipakai daftar REF.
 *
 * STATUS: belum ada golden file dari ekspor Excel dan belum diuji impor di Coretax.
 */
export const meta = {
  id: '2024.12',
  dokumen: 'bupot26',
  berlakuMulai: '2025-01-01',
  template: 'BP26 Excel to XML.xlsx / bp26.xml',
  converter: 'Excel (Developer > Export XML)',
  terverifikasiDenganXsdResmi: true,
  sumber: [
    'https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml',
    'https://pajak.go.id/sites/default/files/2024-12/BP26%20Excel%20to%20XML.xlsx',
    'https://pajak.go.id/sites/default/files/2024-12/bp26.zip',
  ],
} as const

/** Anak langsung `BP26`, urut sesuai XSD. */
export const elemenBupot = [
  'TaxPeriodMonth',
  'TaxPeriodYear',
  'CounterpartTin',
  'CounterpartReceiptNumber',
  'CounterpartName',
  'CounterpartCountry',
  'CounterpartAddress',
  'CounterpartDob',
  'CounterpartBirthCity',
  'CounterpartPassport',
  'CounterpartKitas',
  'TaxCertificate',
  'TaxObjectCode',
  'Gross',
  'Deemed',
  'Rate',
  'Document',
  'DocumentNumber',
  'DocumentDate',
  'IDPlaceOfBusinessActivity',
  'WithholdingDate',
] as const

/** Elemen yang boleh kosong; ditulis `<X xsi:nil="true"/>` seperti sampel DJP. */
export const elemenNil = [
  'CounterpartAddress',
  'CounterpartDob',
  'CounterpartBirthCity',
  'CounterpartPassport',
  'CounterpartKitas',
  'DocumentDate',
] as const

/** Kode objek pajak PPh 26 dari sheet REF: nama, deemed (persen), dan tarif tetap (persen). */
export const kodeObjekPajak: Record<string, { nama: string; deemed: number; tarif: number }> = {
  '27-100-99': {
    nama: 'Imbalan sehubungan dengan jasa, pekerjaan dan kegiatan, hadiah dan penghargaan, pensiun dan pembayaran berkala lainnya yang dipotong PPh Pasal 26',
    deemed: 100,
    tarif: 20,
  },
}

export const fasilitas: Record<string, string> = {
  'N/A': 'Tanpa Fasilitas',
  COD: 'Surat Keterangan Domisili (SKD)',
  DTP: 'PPh Ditanggung Pemerintah (DTP)',
  ETC: 'Fasilitas Lainnya',
}
