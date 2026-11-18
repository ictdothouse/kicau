# Kicau

App mikroblog ringkas (gaya Threads/Twitter) untuk latihan Web Development.

```
frontend/ (HTML, CSS, JS)  --fetch()-->  api/worker.js (Cloudflare Worker)  --> D1 (data teks)
                                                                           --> KV (gambar & video)
```

Perlu: Node.js 20+ dan text editor. Akaun Cloudflare (percuma, tanpa kad) hanya diperlukan untuk deploy.

## Jalankan di komputer sendiri

```bash
git clone https://github.com/ictdothouse/kicau.git
cd kicau
npm install
npm run db:init     # cipta table dalam D1 local
npm run dev         # buka http://localhost:8787
```

D1 dan KV disimulasi dalam folder `.wrangler/`. Tiada akaun diperlukan semasa belajar.

## Deploy ke Cloudflare (akaun anda sendiri)

```bash
npx wrangler login
npx wrangler d1 create kicau-db                  # salin "database_id" ke wrangler.jsonc
npx wrangler kv namespace create kicau-media     # salin "id" ke kv_namespaces dalam wrangler.jsonc
npm run db:init:remote                           # cipta table dalam D1 sebenar
npm run deploy                                   # URL: https://kicau.<subdomain-anda>.workers.dev
```

Frontend dan API dihantar dari URL yang sama, jadi `const API = ''` dalam `app.js` tidak perlu diubah.

## Fail

| Fail | Fungsi |
|------|--------|
| `frontend/index.html` | Struktur halaman + templat post |
| `frontend/style.css` | Gaya (termasuk mod gelap) |
| `frontend/app.js` | `fetch()` ke API: post, like, reply, upload |
| `api/worker.js` | API: baca/tulis D1, simpan/ambil fail dalam KV |
| `api/schema.sql` | Table `posts` dan `profiles` |
| `wrangler.jsonc` | Tetapan Worker: fail utama, folder frontend, binding D1 dan KV |
| `package.json` | Skrip `npm run dev`, `db:init`, `deploy` |

## API

| Kaedah | URL | Body |
|--------|-----|------|
| GET  | `/api/posts` | |
| POST | `/api/posts` | `{ "username": "ali", "content": "hai", "media_key": "<key>" }` (`media_key` pilihan) |
| POST | `/api/posts` (reply) | `{ "username": "ali", "content": "hai", "parent_id": 1 }` |
| GET  | `/api/posts/1/replies` | |
| POST | `/api/posts/1/like` | |
| POST | `/api/upload` | fail itu sendiri, header `Content-Type: image/png` dll. Balas `{ "key": "..." }` |
| GET  | `/api/profiles/ali` | |
| PUT  | `/api/profiles/ali` | `{ "avatar_key": "<key>" }` |
| GET  | `/media/<key>` | papar gambar/video |

Fail dibenarkan: JPG, PNG, WebP, GIF (maks 5 MB), MP4, WebM (maks 20 MB).

## Nota

- **Naik taraf dari Bahagian 1** (table `posts` sudah wujud): jalankan sekali dahulu
  `npx wrangler d1 execute DB --local --command "ALTER TABLE posts ADD COLUMN media_key TEXT"`
  (atau `--remote`), kemudian `npm run db:init`.
- API terbuka kepada sesiapa yang tahu URL. Sesuai untuk kelas, bukan untuk produksi. Login datang dalam Bahagian 3.
- Pelan percuma KV: 1 GB storan, 1,000 upload sehari. Bila had habis, upload gagal sehingga esok; tiada caj.
- Industri biasanya guna object storage seperti Cloudflare R2 atau AWS S3. Kodnya hampir sama
  (`put`/`get` ikut key), tetapi R2 memerlukan kad bayaran.
- Kosongkan data local: padam folder `.wrangler/`, kemudian `npm run db:init`.

## Latihan

Bahagian 1:
1. Tukar warna/tema dalam `style.css`.
2. Papar tarikh penuh bila hover pada masa post.
3. Auto-refresh feed setiap 10 saat (`setInterval`).

Bahagian 2:
1. Semak saiz fail dalam browser sebelum upload (`file.size`), dan beri mesej yang jelas.
2. Tambah medan "teks alternatif" untuk gambar post (aksesibiliti).
3. Benarkan seret-lepas (drag and drop) fail ke atas borang.
4. Cuba upload fail `.svg` atau fail 30 MB. Kenapa server menolak?
