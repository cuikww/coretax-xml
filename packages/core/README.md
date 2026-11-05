# coretax-xml

Buat dan validasi file XML impor Coretax DJP (faktur pajak keluaran) langsung dari data aplikasi, dengan pesan error Bahasa Indonesia.

> **Pra-rilis.** Struktur XML belum dicocokkan dengan XSD resmi DJP. Lihat [README repo](https://github.com/cuikww/coretax-xml#readme) untuk status dan dokumentasi lengkap.

```ts
import { fakturKeluaran } from 'coretax-xml'

const hasil = fakturKeluaran.validate(batch) // { valid, schema, errors, warnings }
const xml = fakturKeluaran.build(batch) // melempar CoretaxValidationError jika tidak valid
```

Bukan produk DJP dan bukan nasihat pajak. Tanpa panggilan jaringan. Lisensi MIT.
