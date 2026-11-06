# coretax-xml

Buat dan validasi file XML impor Coretax DJP (faktur pajak keluaran) langsung dari data aplikasi, dengan pesan error Bahasa Indonesia.

> **Pra-rilis.** Urutan elemen dan tabel referensi sudah dicocokkan dengan paket resmi DJP (converter v1.6, template v1.6.1) dan output-nya sama dengan converter untuk 10 kasus uji, tetapi **belum** diuji impor di Coretax sungguhan. DJP tidak menerbitkan XSD. Lihat [README repo](https://github.com/cuikww/coretax-xml#readme) untuk status dan dokumentasi lengkap.

```ts
import { fakturKeluaran } from 'coretax-xml'

const hasil = fakturKeluaran.validate(batch) // { valid, schema, errors, warnings }
const xml = fakturKeluaran.build(batch) // melempar CoretaxValidationError jika tidak valid
```

Bukan produk DJP dan bukan nasihat pajak. Tanpa panggilan jaringan. Lisensi MIT.
