/** Bagian yang sama untuk BP21 dan BP26 (sheet REF kedua template identik). */

/** Tabel [batas atas DPP (inklusif), tarif %]; batas null = tanpa batas. */
export type TabelTarif = readonly (readonly [number | null, number])[]

/** Jenis dokumen referensi dari sheet REF. */
export const jenisDokumen: Record<string, string> = {
  Announcement: 'Pengumuman',
  CommercialInvoice: 'Surat Tagihan',
  Contract: 'Kontrak',
  CurrentAccount: 'Jasa Giro',
  Decree: 'Decree',
  DeedOfEngagement: 'Akta Perjanjian',
  DeedOfGeneral: 'Akta RUPS',
  Other: 'Lainnya',
  OtherFacilityDoc: 'Dokumen Fasilitas Lainnya',
  PaymentProof: 'Bukti Pembayaran',
  StatementLetter: 'Surat Pernyataan',
  TaxInvoice: 'Faktur Pajak',
  TaxRegulationDoc: 'Dokumen Perpajakan',
  TradeConfirmation: 'Trade Confirmation',
}
