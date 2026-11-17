# @coretax-xml/cli

## 0.3.0

### Minor Changes

- 4397a67: Bukti potong PPh 21 dan 26: `bupot21` dan `bupot26` (build, validate, analisis, check) dengan deemed dan tarif otomatis seperti rumus template DJP (TER, Pasal 17, harian, pesangon, pensiun). CLI membaca template Excel DJP "BP21 Excel to XML v.4" / "BP26 Excel to XML" dan CSV (`template bupot21|bupot26`), serta memeriksa XML `Bp21Bulk`/`BP26Bulk`. Belum diuji impor di Coretax.

### Patch Changes

- Updated dependencies [4397a67]
  - @coretax-xml/core@0.3.0

## 0.2.2

### Patch Changes

- 9a28f57: README: badge versi npm dan link ke halaman npm. Rilis pertama lewat GitHub Actions dengan provenance (trusted publishing).
- Updated dependencies [9a28f57]
  - @coretax-xml/core@0.2.1

## 0.2.1

### Patch Changes

- Bergantung pada `@coretax-xml/core` (library core pindah nama; nama `coretax-xml` di npm sudah dipakai pihak lain). 0.2.0 menunjuk ke paket `coretax-xml` yang bukan milik proyek ini: jangan dipakai.

## 0.2.0

### Minor Changes

- Rilis pra-rilis publik pertama (0.2.0): faktur pajak keluaran, retur faktur pajak masukan, `check()`, `buildStream`, nama field Inggris, katalog kode error, dan CLI (`convert`, `check`, `template`, `schemas`). Belum diuji impor di Coretax sungguhan.

### Patch Changes

- Updated dependencies
  - coretax-xml@0.2.0
