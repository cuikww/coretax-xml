# @coretax-xml/core

## 0.3.0

### Minor Changes

- 4397a67: Bukti potong PPh 21 dan 26: `bupot21` dan `bupot26` (build, validate, analisis, check) dengan deemed dan tarif otomatis seperti rumus template DJP (TER, Pasal 17, harian, pesangon, pensiun). CLI membaca template Excel DJP "BP21 Excel to XML v.4" / "BP26 Excel to XML" dan CSV (`template bupot21|bupot26`), serta memeriksa XML `Bp21Bulk`/`BP26Bulk`. Belum diuji impor di Coretax.

## 0.2.1

### Patch Changes

- 9a28f57: README: badge versi npm dan link ke halaman npm. Rilis pertama lewat GitHub Actions dengan provenance (trusted publishing).

## 0.2.0

Diterbitkan sebagai `@coretax-xml/core` (nama `coretax-xml` di npm milik pihak lain).

### Minor Changes

- Rilis pra-rilis publik pertama (0.2.0): faktur pajak keluaran, retur faktur pajak masukan, `check()`, `buildStream`, nama field Inggris, katalog kode error, dan CLI (`convert`, `check`, `template`, `schemas`). Belum diuji impor di Coretax sungguhan.
