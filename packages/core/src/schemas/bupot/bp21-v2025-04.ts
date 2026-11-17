/**
 * Skema bukti potong PPh 21, versi 2025.04 (root XML `Bp21Bulk`).
 *
 * Dasar: "BP21 Excel to XML v.4.xlsx" (https://pajak.go.id/sites/default/files/2025-04/BP21%20Excel%20to%20XML%20v.4.xlsx) dan sampel bp21.zip dari halaman resmi DJP (diunduh 2026-11-17).
 * Urutan elemen dan tipe dari XSD yang tertanam di Excel (XML Map); daftar kode dari sheet REF. Daftar jenis
 * dokumen di XSD itu sudah usang (mis. "Announchment"), jadi dipakai daftar REF. Tabel tarif dibuat dari rumus sheet DATA (salinannya di fixtures/bupot/rumus-bp21.json).
 *
 * STATUS: belum ada golden file dari ekspor Excel dan belum diuji impor di Coretax.
 */
import type { TabelTarif } from './umum.js'

export const meta = {
  id: '2025.04',
  dokumen: 'bupot21',
  berlakuMulai: '2025-01-01',
  template: 'BP21 Excel to XML v.4.xlsx / bp21.xml',
  converter: 'Excel (Developer > Export XML)',
  terverifikasiDenganXsdResmi: true,
  sumber: [
    'https://www.pajak.go.id/id/reformdjp/coretax/template-xml-dan-converter-excel-ke-xml',
    'https://pajak.go.id/sites/default/files/2025-04/BP21%20Excel%20to%20XML%20v.4.xlsx',
    'https://pajak.go.id/sites/default/files/2024-12/bp21.zip',
  ],
} as const

/** Anak langsung `Bp21` (satu bukti potong), urut sesuai XSD. */
export const elemenBupot = [
  'TaxPeriodMonth',
  'TaxPeriodYear',
  'CounterpartTin',
  'IDPlaceOfBusinessActivityOfIncomeRecipient',
  'StatusTaxExemption',
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

/** Elemen yang boleh kosong; ditulis `<X xsi:nil="true"/>`. */
export const elemenNil = ['DocumentDate'] as const

/** Cara tarif dihitung di template (kolom D sheet REF): nama tabel, atau tarif tetap dalam persen. */
export type CaraTarif = 'TER' | 'PS17' | 'HARIAN' | 'PESANGON' | 'PENSIUN' | number

/** Kode objek pajak PPh 21 dari sheet REF: nama, deemed (norma, persen), dan cara tarif. */
export const kodeObjekPajak: Record<string, { nama: string; deemed: number; tarif: CaraTarif }> = {
  '21-100-35': { nama: 'Upah Pegawai Tidak Tetap yang Dibayarkan secara Bulanan', deemed: 100, tarif: 'TER' },
  '21-100-10': {
    nama: 'Honorarium atau Imbalan kepada Anggota Dewan Komisaris atau Dewan Pengawas yang Menerima Imbalan secara Tidak Teratur',
    deemed: 100,
    tarif: 'TER',
  },
  '21-100-27': {
    nama: 'Upah Pegawai Tidak Tetap yang Dibayarkan secara Bulanan yang Mendapat Fasilitas di Daerah Tertentu',
    deemed: 100,
    tarif: 'TER',
  },
  '21-100-07': {
    nama: 'Imbalan kepada Tenaga Ahli (Pengacara, Akuntan, Arsitek, Dokter, Konsultan, Notaris, Pejabat Pembuat Akte Tanah, Penilai, Aktuaris)',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-18': {
    nama: 'Imbalan kepada Penasihat, Pengajar, Pelatih, Penceramah, Penyuluh, dan Moderator',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-19': { nama: 'Imbalan kepada Pengarang, Peneliti, Penerjemah', deemed: 50, tarif: 'PS17' },
  '21-100-20': { nama: 'Imbalan kepada Pemberi Jasa dalam Segala Bidang', deemed: 50, tarif: 'PS17' },
  '21-100-21': { nama: 'Imbalan kepada Agen Iklan', deemed: 50, tarif: 'PS17' },
  '21-100-22': { nama: 'Imbalan kepada Pengawas atau Pengelola Proyek', deemed: 50, tarif: 'PS17' },
  '21-100-23': {
    nama: 'Imbalan kepada Pembawa Pesanan atau yang Menemukan Langganan atau yang Menjadi Perantara',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-06': { nama: 'Imbalan kepada Petugas Penjaja Barang Dagangan', deemed: 50, tarif: 'PS17' },
  '21-100-05': { nama: 'Imbalan kepada Agen Asuransi', deemed: 50, tarif: 'PS17' },
  '21-100-04': {
    nama: 'Imbalan kepada Distributor Perusahaan Pemasaran Berjenjang atau Penjualan Langsung dan Kegiatan Sejenis Lainnya',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-30': {
    nama: 'Upah Pegawai Tidak Tetap yang Dibayarkan secara Harian, Mingguan, Satuan dan Borongan dengan Penghasilan Bruto lebih dari Rp2.500.000 Sehari',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-31': {
    nama: 'Upah Pegawai Tidak Tetap yang Dibayarkan secara Harian, Mingguan, Satuan dan Borongan dengan Penghasilan Bruto lebih dari Rp2.500.000 Sehari yang Mendapat Fasilitas di Daerah Tertentu',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-12': {
    nama: 'Uang Manfaat Pensiun atau Penghasilan Sejenisnya yang diambil sebagian oleh Peserta Program Pensiun yang Masih Berstatus sebagai Pegawai',
    deemed: 100,
    tarif: 'PS17',
  },
  '21-100-36': {
    nama: 'Imbalan kepada Peserta Perlombaan dalam Segala Bidang, antara lain Perlombaan Olah Raga, Seni, Ketangkasan, Ilmu Pengetahuan, Teknologi, dan Perlombaan Lainnya',
    deemed: 100,
    tarif: 'PS17',
  },
  '21-100-14': {
    nama: 'Imbalan kepada Peserta Rapat, Konferensi, Sidang, Pertemuan, Kunjungan Kerja, Seminar, Lokakarya, atau Pertunjukan, atau Kegiatan Tertentu Lainnya',
    deemed: 100,
    tarif: 'PS17',
  },
  '21-100-15': {
    nama: 'Imbalan kepada Peserta atau Anggota dalam Suatu Kepanitiaan sebagai Penyelenggara Kegiatan Tertentu',
    deemed: 100,
    tarif: 'PS17',
  },
  '21-100-16': {
    nama: 'Imbalan kepada Peserta Pendidikan, Pelatihan, dan Magang',
    deemed: 100,
    tarif: 'PS17',
  },
  '21-100-17': { nama: 'Imbalan kepada Peserta Kegiatan Lainnya', deemed: 100, tarif: 'PS17' },
  '21-100-25': {
    nama: 'Penghasilan berupa Uang Pesangon, Uang Manfaat Pensiun, Tunjangan Hari Tua, atau Jaminan Hari Tua yang Terutang atau Dibayarkan pada Tahun Ketiga dan Tahun-Tahun Berikutnya',
    deemed: 100,
    tarif: 'PS17',
  },
  '21-100-33': {
    nama: 'Imbalan kepada Pemain Musik, Pembawa Acara, Penyanyi, Pelawak, Bintang Film, Bintang Sinetron, Bintang Iklan, Sutradara, Kru Film, Foto Model, Peragawan/Peragawati, Pemain Drama, Penari, Pemahat, Pelukis, Pembuat/Pencipta Konten pada Media yang Dibagikan secara Daring (Influencer, Selebgram, Blogger, Vlogger, dan Sejenis Lainnya), dan Seniman Lainnya',
    deemed: 50,
    tarif: 'PS17',
  },
  '21-100-34': { nama: 'Imbalan yang Diterima oleh Olahragawan', deemed: 50, tarif: 'PS17' },
  '21-100-24': {
    nama: 'Upah Pegawai Tidak Tetap yang Dibayarkan secara Harian, Mingguan, Satuan dan Borongan dengan Penghasilan Bruto sampai dengan Rp2.500.000 Sehari',
    deemed: 100,
    tarif: 'HARIAN',
  },
  '21-100-29': {
    nama: 'Upah Pegawai Tidak Tetap yang Dibayarkan secara Harian, Mingguan, Satuan dan Borongan dengan Penghasilan Bruto sampai dengan Rp2.500.000 Sehari yang Mendapat Fasilitas di Daerah Tertentu',
    deemed: 100,
    tarif: 'HARIAN',
  },
  '21-402-04': {
    nama: 'Honor atau Imbalan Lain yang Dibebankan kepada APBN atau APBD yang Diterima oleh PNS Golongan I dan Golongan II, Anggota TNI dan Anggota POLRI Golongan Pangkat Tamtama dan Bintara, dan Pensiunannya',
    deemed: 100,
    tarif: 0,
  },
  '21-402-02': {
    nama: 'Honor atau Imbalan Lain yang Dibebankan kepada APBN atau APBD yang Diterima oleh PNS Golongan III, Anggota TNI dan Anggota POLRI Golongan Pangkat Perwira Pertama, dan Pensiunannya',
    deemed: 100,
    tarif: 5,
  },
  '21-402-03': {
    nama: 'Honor atau Imbalan Lain yang Dibebankan kepada APBN atau APBD yang Diterima oleh Pejabat Negara, PNS Golongan IV, Anggota TNI dan Anggota POLRI Golongan Pangkat Perwira Menengah dan Perwira Tinggi, dan Pensiunannya',
    deemed: 100,
    tarif: 15,
  },
  '21-401-01': { nama: 'Uang Pesangon yang Dibayarkan Sekaligus', deemed: 100, tarif: 'PESANGON' },
  '21-401-02': {
    nama: 'Uang Manfaat Pensiun, Tunjangan Hari Tua, atau Jaminan Hari Tua yang Dibayarkan Sekaligus',
    deemed: 100,
    tarif: 'PENSIUN',
  },
  '21-100-37': {
    nama: 'Penghasilan yang Diterima atau Diperoleh Pegawai Tetap di Daerah Tertentu yang Tidak Memenuhi Persyaratan Fasilitas',
    deemed: 100,
    tarif: 'TER',
  },
}

export const fasilitas: Record<string, string> = {
  'N/A': 'Tanpa Fasilitas',
  TaxExAr21: 'Surat Keterangan Bebas (SKB) Pemotongan PPh Pasal 21',
  DTP: 'PPh Ditanggung Pemerintah (DTP)',
  ETC: 'Fasilitas Lainnya',
}

/** Status PTKP yang diterima XSD. */
export const statusPtkp: readonly string[] = ['TK/0', 'TK/1', 'TK/2', 'TK/3', 'K/0', 'K/1', 'K/2', 'K/3']

/** Kategori TER per status PTKP, persis seperti rumus kolom Tarif template (HB/x tidak diterima XSD). */
export const kategoriTer: Record<string, 'A' | 'B' | 'C'> = {
  'TK/0': 'A',
  'TK/1': 'A',
  'K/0': 'A',
  'TK/2': 'B',
  'TK/3': 'B',
  'K/1': 'B',
  'K/2': 'B',
  'K/3': 'C',
}

// Tabel tarif: DPP = penghasilan x deemed / 100, dibandingkan dengan batas atas tiap baris.
/** Tarif efektif rata-rata (TER) kategori A, kolom T template. */
export const terA: TabelTarif = [
  [5400000, 0],
  [5650000, 0.25],
  [5950000, 0.5],
  [6300000, 0.75],
  [6750000, 1],
  [7500000, 1.25],
  [8550000, 1.5],
  [9650000, 1.75],
  [10050000, 2],
  [10350000, 2.25],
  [10700000, 2.5],
  [11050000, 3],
  [11600000, 3.5],
  [12500000, 4],
  [13750000, 5],
  [15100000, 6],
  [16950000, 7],
  [19750000, 8],
  [24150000, 9],
  [26450000, 10],
  [28000000, 11],
  [30050000, 12],
  [32400000, 13],
  [35400000, 14],
  [39100000, 15],
  [43850000, 16],
  [47800000, 17],
  [51400000, 18],
  [56300000, 19],
  [62200000, 20],
  [68600000, 21],
  [77500000, 22],
  [89000000, 23],
  [103000000, 24],
  [125000000, 25],
  [157000000, 26],
  [206000000, 27],
  [337000000, 28],
  [454000000, 29],
  [550000000, 30],
  [695000000, 31],
  [910000000, 32],
  [1400000000, 33],
  [null, 34],
]

/** TER kategori B, kolom U. */
export const terB: TabelTarif = [
  [6200000, 0],
  [6500000, 0.25],
  [6850000, 0.5],
  [7300000, 0.75],
  [9200000, 1],
  [10750000, 1.5],
  [11250000, 2],
  [11600000, 2.5],
  [12600000, 3],
  [13600000, 4],
  [14950000, 5],
  [16400000, 6],
  [18450000, 7],
  [21850000, 8],
  [26000000, 9],
  [27700000, 10],
  [29350000, 11],
  [31450000, 12],
  [33950000, 13],
  [37100000, 14],
  [41100000, 15],
  [45800000, 16],
  [49500000, 17],
  [53800000, 18],
  [58500000, 19],
  [64000000, 20],
  [71000000, 21],
  [80000000, 22],
  [93000000, 23],
  [109000000, 24],
  [129000000, 25],
  [163000000, 26],
  [211000000, 27],
  [374000000, 28],
  [459000000, 29],
  [555000000, 30],
  [704000000, 31],
  [957000000, 32],
  [1405000000, 33],
  [null, 34],
]

/** TER kategori C, kolom V. */
export const terC: TabelTarif = [
  [6600000, 0],
  [6950000, 0.25],
  [7350000, 0.5],
  [7800000, 0.75],
  [8850000, 1],
  [9800000, 1.25],
  [10950000, 1.5],
  [11200000, 1.75],
  [12050000, 2],
  [12950000, 3],
  [14150000, 4],
  [15550000, 5],
  [17050000, 6],
  [19500000, 7],
  [22700000, 8],
  [26600000, 9],
  [28100000, 10],
  [30100000, 11],
  [32600000, 12],
  [35400000, 13],
  [38900000, 14],
  [43000000, 15],
  [47400000, 16],
  [51200000, 17],
  [55800000, 18],
  [60400000, 19],
  [66700000, 20],
  [74500000, 21],
  [83200000, 22],
  [95600000, 23],
  [110000000, 24],
  [134000000, 25],
  [169000000, 26],
  [221000000, 27],
  [390000000, 28],
  [463000000, 29],
  [561000000, 30],
  [709000000, 31],
  [965000000, 32],
  [1419000000, 33],
  [null, 34],
]

/** Pasal 17: tarif lapisan tempat DPP berada (bukan dihitung progresif per lapisan), kolom W. */
export const pasal17: TabelTarif = [
  [60000000, 5],
  [250000000, 15],
  [500000000, 25],
  [5000000000, 30],
  [null, 35],
]

/** Upah harian, kolom X. Di atas Rp2.500.000 rumus template memberi 0 (kode untuk itu memakai PS17). */
export const harian: TabelTarif = [
  [450000, 0],
  [2500000, 0.5],
  [null, 0],
]

/** Pesangon sekaligus, kolom Y. */
export const pesangon: TabelTarif = [
  [50000000, 0],
  [100000000, 5],
  [500000000, 15],
  [null, 25],
]

/** Pensiun/JHT sekaligus, kolom Z. */
export const pensiun: TabelTarif = [
  [50000000, 0],
  [null, 5],
]
