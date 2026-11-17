# Kicau

App mikroblog ringkas (gaya Threads/Twitter) untuk latihan Web Development.

```
frontend/  (HTML, CSS, JS)  --fetch()-->  api/ (Cloudflare Worker)  --SQL-->  D1
   ^ pelajar                                ^ pensyarah deploy sekali
```

Pelajar **tidak perlu install apa-apa**. Hanya browser dan text editor.

## Untuk pelajar

1. Muat turun folder `frontend/` (GitHub: **Code → Download ZIP**).
2. Buka `frontend/app.js`, pastikan baris `const API = '...'` ialah URL yang diberi pensyarah.
3. Double-click `frontend/index.html`. Siap.

| Fail | Fungsi |
|------|--------|
| `index.html` | Struktur halaman + templat post |
| `style.css` | Gaya (termasuk mod gelap) |
| `app.js` | `fetch()` ke API, papar post, like, reply |

API yang boleh dipanggil:

| Kaedah | URL | Body |
|--------|-----|------|
| GET  | `/api/posts` | |
| POST | `/api/posts` | `{ "username": "ali", "content": "hai" }` |
| POST | `/api/posts` (reply) | `{ "username": "ali", "content": "hai", "parent_id": 1 }` |
| GET  | `/api/posts/1/replies` | |
| POST | `/api/posts/1/like` | |

## Untuk pensyarah: deploy API (sekali sahaja)

Perlu Node.js. Jalankan dalam folder `api/`:

```bash
cd api
npx wrangler login
npx wrangler d1 execute DB --remote --file=schema.sql   # cipta table dalam D1
npx wrangler deploy                                     # beri URL https://kicau.<subdomain>.workers.dev
```

Salin URL itu ke `const API` dalam `frontend/app.js`, kemudian edar folder `frontend/`.
URL Worker yang sama juga memaparkan app penuh (untuk demo di projektor).

Uji di local sebelum deploy: `npx wrangler d1 execute DB --local --file=schema.sql`
kemudian `npx wrangler dev`, dan biarkan `const API = 'http://127.0.0.1:8787'`.

## Push ke GitHub

```bash
git init
git add .
git commit -m "Kicau versi pertama"
git branch -M main
git remote add origin https://github.com/<username>/kicau.git
git push -u origin main
```

Deploy automatik setiap push (pilihan): Cloudflare Dashboard → **Workers & Pages** → **Create**
→ **Import a repository** → pilih `kicau` → set **Root directory** = `api` → **Deploy**.

## Nota

- API terbuka kepada sesiapa yang tahu URL. Sesuai untuk kelas, bukan untuk produksi.
- Padam semua post (reset kelas): `npx wrangler d1 execute DB --remote --command "DELETE FROM posts"`

## Latihan lanjutan

1. Tukar warna/tema dalam `style.css`.
2. Papar tarikh penuh bila hover pada masa post.
3. Auto-refresh feed setiap 10 saat (`setInterval`).
4. Butang kongsi post (salin teks ke clipboard).
