import { describe, expect, it } from 'vitest'
import { CoretaxValidationError, type FakturKeluaran, fakturKeluaran } from '../src/index.js'

const NOL16 = '0000000000000000'
const NOL22 = '0000000000000000000000'
const penjual = { npwp: NOL16, nitku: NOL22 }

const faktur = (n: number, ubah: Partial<FakturKeluaran> = {}): FakturKeluaran => ({
  tanggal: '2026-10-01',
  kodeTransaksi: '04',
  referensi: `INV-${n}`,
  pembeli: { jenisId: 'TIN', npwp: NOL16, nitku: NOL22, nama: 'PT A', alamat: 'Jl. A' },
  item: [{ jenis: 'jasa', nama: 'X', satuan: 'UM.0033', harga: 1000 * n, jumlah: 1 }],
  ...ubah,
})
const daftar = (n: number) => Array.from({ length: n }, (_, i) => faktur(i + 1))

async function semua<T>(gen: AsyncIterable<T>): Promise<T[]> {
  const hasil: T[] = []
  for await (const x of gen) hasil.push(x)
  return hasil
}

describe('buildStream', () => {
  it('memecah menjadi file berisi maksimal maksPerFile faktur, dengan nama dan nomor berurut', async () => {
    const f = await semua(fakturKeluaran.buildStream({ penjual, faktur: daftar(5) }, { maksPerFile: 2 }))
    expect(f.map((x) => [x.nama, x.jumlahFaktur, x.nomorFakturAwal])).toEqual([
      ['faktur-keluaran-0001.xml', 2, 1],
      ['faktur-keluaran-0002.xml', 2, 3],
      ['faktur-keluaran-0003.xml', 1, 5],
    ])
    for (const x of f) expect(fakturKeluaran.check(x.isi).errors).toEqual([]) // setiap file berdiri sendiri
    expect(f.flatMap((x) => [...x.isi.matchAll(/<RefDesc>([^<]*)<\/RefDesc>/g)].map((m) => m[1]))).toEqual([
      'INV-1',
      'INV-2',
      'INV-3',
      'INV-4',
      'INV-5',
    ])
  })

  it('satu file dengan isi sama persis seperti build() biasa', async () => {
    const [f, ...sisa] = await semua(fakturKeluaran.buildStream({ penjual, faktur: daftar(3) }))
    expect(sisa).toEqual([])
    expect(f?.isi).toBe(fakturKeluaran.build({ penjual, faktur: daftar(3) }))
  })

  it('membaca sumber secukupnya: file pertama diserahkan sebelum sumber habis', async () => {
    let dibaca = 0
    async function* sumber() {
      for (let i = 1; i <= 10; i++) {
        dibaca++
        yield faktur(i)
      }
    }
    const gen = fakturKeluaran.buildStream({ penjual, faktur: sumber() }, { maksPerFile: 3 })
    const pertama = await gen.next()
    expect(pertama.value?.jumlahFaktur).toBe(3)
    expect(dibaca).toBe(3) // belum menarik faktur ke-4
    await gen.return(undefined)
  })

  it('nomor faktur di error tetap global; file sebelum yang rusak sudah diserahkan', async () => {
    const data = daftar(5)
    data[3] = faktur(4, { tanggal: '2026-02-30' }) // faktur ke-4, ada di file ke-2
    const gen = fakturKeluaran.buildStream({ penjual, faktur: data }, { maksPerFile: 2 })
    expect((await gen.next()).value?.nomor).toBe(1)
    const err = await gen.next().catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CoretaxValidationError)
    const e = (err as CoretaxValidationError).hasil.errors
    expect(e.map((x) => [x.code, x.faktur])).toEqual([['DATE_FORMAT', 4]])
  })

  it('sumber kosong, maksPerFile salah, awalan nama', async () => {
    await expect(semua(fakturKeluaran.buildStream({ penjual, faktur: [] }))).rejects.toThrow(
      CoretaxValidationError,
    )
    await expect(
      semua(fakturKeluaran.buildStream({ penjual, faktur: daftar(1) }, { maksPerFile: 0 })),
    ).rejects.toThrow(RangeError)
    const [f] = await semua(fakturKeluaran.buildStream({ penjual, faktur: daftar(1) }, { awalanNama: 'okt' }))
    expect(f?.nama).toBe('okt-0001.xml')
  })

  it('meneruskan peringatan dan opsi validasi (bahasa)', async () => {
    const data = [faktur(1, { item: [{ jenis: 'jasa', nama: 'X', satuan: 'UM.0033', harga: 1, jumlah: 1 }] })]
    const [f] = await semua(fakturKeluaran.buildStream({ penjual, faktur: data }))
    expect(f?.peringatan.map((p) => p.code)).toEqual(['GOODS_CODE_DEFAULT'])
    const rusak = [faktur(1, { tanggal: 'x' })]
    await expect(
      semua(fakturKeluaran.buildStream({ penjual, faktur: rusak }, { bahasa: 'en' })),
    ).rejects.toThrow(/not a valid date/)
  })
})
