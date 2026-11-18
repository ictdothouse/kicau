# Kicau

App mikroblog ringkas (gaya Threads/Twitter) untuk latihan Web Development.

```
frontend/ (HTML, CSS, JS)  --fetch()-->  api/worker.js (Cloudflare Worker)  --> D1 (data teks)
                                                                           --> KV (gambar & video)
```

Tiada install. Pelajar hanya perlukan browser, text editor dan akaun Cloudflare percuma (tanpa kad).

| Versi | Isi | Muat turun |
|-------|-----|------------|
| Bahagian 1 | Post, like, reply (D1) | tag `bahagian-1` |
| Bahagian 2 | + gambar profil, gambar/video pada post (KV) | tag `bahagian-2` |

## Fail

| Fail | Fungsi |
|------|--------|
| `frontend/index.html` | Struktur halaman + templat post |
| `frontend/style.css` | Gaya (termasuk mod gelap) |
| `frontend/app.js` | `fetch()` ke API: post, like, reply, upload |
| `frontend/panduan.html` | Panduan pelajar |
| `api/worker.js` | API: baca/tulis D1, simpan/ambil fail dalam KV |
| `api/schema.sql` | Table `posts` dan `profiles` |
| `api/wrangler.jsonc` | Tetapan untuk deploy dengan CLI (pensyarah sahaja) |

## Pelajar: deploy API sendiri melalui Cloudflare Dashboard

Log masuk ke https://dash.cloudflare.com (daftar percuma, tiada kad diperlukan).
Nama menu dalam Dashboard mungkin sedikit berbeza dari senarai ini.

1. **Database D1**: Storage & Databases → D1 SQL Database → Create → nama `kicau-db`.
   Buka database itu → tab **Console** → paste isi `api/schema.sql` → Execute.
   Jika ralat, paste dan Execute setiap arahan `CREATE ...;` satu demi satu.
2. **Storage KV**: Storage & Databases → Workers KV → Create namespace → nama `kicau-media`.
3. **Worker**: Workers & Pages → Create → Hello World → beri nama, contoh `kicau-ali` → Deploy.
   Kemudian **Edit code** → padam semua kod → paste isi `api/worker.js` → Deploy.
4. **Binding** (sambung Worker kepada D1 dan KV): Worker → Settings → Bindings → Add.
   - D1 database: Variable name `DB`, pilih `kicau-db`.
   - KV namespace: Variable name `MEDIA`, pilih `kicau-media`.
5. **Uji**: buka `https://kicau-ali.<subdomain-anda>.workers.dev/api/posts`. Jawapan `[]` bermaksud API berjaya.
6. Salin URL Worker ke `const API` dalam `frontend/app.js`, kemudian double-click `frontend/index.html`.

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

## Pensyarah: deploy dengan CLI (pilihan)

Perlu Node.js. Dalam folder `api/`:

```bash
npx wrangler login
npx wrangler kv namespace create kicau-media      # salin "id" ke kv_namespaces dalam wrangler.jsonc
npx wrangler d1 execute DB --remote --file=schema.sql
npx wrangler deploy
```

Uji di komputer sendiri: `npx wrangler d1 execute DB --local --file=schema.sql`, kemudian `npx wrangler dev`
dan set `const API = 'http://127.0.0.1:8787'`.

**Naik taraf dari Bahagian 1** (table `posts` sudah wujud): jalankan sekali dahulu
`ALTER TABLE posts ADD COLUMN media_key TEXT;`, kemudian `schema.sql`.

## Nota

- API terbuka kepada sesiapa yang tahu URL. Sesuai untuk kelas, bukan untuk produksi. Login datang dalam Bahagian 3.
- Pelan percuma KV: 1 GB storan, 1,000 upload sehari. Bila had habis, upload gagal sehingga esok; tiada caj.
- Industri biasanya guna object storage seperti Cloudflare R2 atau AWS S3. Kodnya hampir sama
  (`put`/`get` ikut key), tetapi R2 memerlukan kad bayaran.

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
