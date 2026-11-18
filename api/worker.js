// Kicau: backend API (Cloudflare Worker).
// Boleh di-deploy tanpa install: Cloudflare Dashboard → Workers → cipta Worker → paste fail ini.
//
// Aliran:  frontend --fetch()--> Worker (fail ini) --SQL-----> D1 (data teks)
//                                                  --put/get--> KV (fail gambar & video)
//
// Binding (Dashboard: Worker → Settings → Bindings):
//   DB    = database D1
//   MEDIA = namespace KV
//
// API:
//   GET  /api/posts                senarai post utama (terbaru dahulu)
//   POST /api/posts                cipta post / reply  { username, content, parent_id?, media_key? }
//   GET  /api/posts/:id/replies    senarai reply bagi satu post
//   POST /api/posts/:id/like       tambah 1 like
//   POST /api/upload               muat naik fail (body = fail itu sendiri). Balas { key }
//   GET  /api/profiles/:username   gambar profil  { username, avatar_key }
//   PUT  /api/profiles/:username   tukar gambar profil  { avatar_key }
//   GET  /media/:key               ambil fail dari KV

// CORS: benarkan halaman dari mana-mana tempat (termasuk fail index.html yang
// dibuka terus dari laptop pelajar) memanggil API ini.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Jenis fail yang dibenarkan dan saiz maksimum (MB). Had KV ialah 25 MB satu fail.
// SVG sengaja tidak dibenarkan: fail SVG boleh mengandungi skrip.
const MEDIA_TYPES = {
  'image/jpeg': { ext: 'jpg', maxMB: 5 },
  'image/png': { ext: 'png', maxMB: 5 },
  'image/webp': { ext: 'webp', maxMB: 5 },
  'image/gif': { ext: 'gif', maxMB: 5 },
  'video/mp4': { ext: 'mp4', maxMB: 20 },
  'video/webm': { ext: 'webm', maxMB: 20 },
};

// Bentuk key yang dijana oleh /api/upload: <uuid>.<ext>
const KEY_PATTERN = /^[0-9a-f-]{36}\.(jpg|png|webp|gif|mp4|webm)$/;
const IMAGE_KEY = /\.(jpg|png|webp|gif)$/;

// Post + gambar profil penulis + bilangan reply.
const POST_SELECT = `
  SELECT p.*, pr.avatar_key,
         (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
  FROM posts p
  LEFT JOIN profiles pr ON pr.username = p.username`;

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // Browser hantar OPTIONS dahulu ("preflight") untuk tanya kebenaran CORS.
    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      if (path === '/api/posts' && method === 'GET') {
        const { results } = await env.DB.prepare(
          `${POST_SELECT} WHERE p.parent_id IS NULL ORDER BY p.id DESC LIMIT 50`
        ).all();
        return json(results);
      }

      if (path === '/api/posts' && method === 'POST') {
        // Jangan percaya data dari browser: semak semula di server.
        const body = await request.json().catch(() => ({}));
        const username = String(body.username ?? '').trim();
        const content = String(body.content ?? '').trim();
        const parentId = body.parent_id ?? null;
        const mediaKey = body.media_key ?? null;

        if (!username || username.length > 30) {
          return json({ error: 'Nama mesti 1-30 aksara.' }, 400);
        }
        if (!content || content.length > 500) {
          return json({ error: 'Post mesti 1-500 aksara.' }, 400);
        }
        if (parentId !== null && !Number.isInteger(parentId)) {
          return json({ error: 'parent_id tidak sah.' }, 400);
        }
        if (mediaKey !== null && !KEY_PATTERN.test(mediaKey)) {
          return json({ error: 'media_key tidak sah.' }, 400);
        }

        // Guna tanda ? dan bind(). JANGAN cantum input terus ke dalam string SQL:
        // itu membuka ruang SQL injection.
        const post = await env.DB.prepare(
          'INSERT INTO posts (username, content, parent_id, media_key) VALUES (?, ?, ?, ?) RETURNING *'
        ).bind(username, content, parentId, mediaKey).first();
        return json(post, 201);
      }

      if (path === '/api/upload' && method === 'POST') {
        const contentType = request.headers.get('Content-Type');
        const type = MEDIA_TYPES[contentType];
        if (!type) {
          return json({ error: 'Jenis fail tidak dibenarkan. Guna JPG, PNG, WebP, GIF, MP4 atau WebM.' }, 415);
        }
        const maxBytes = type.maxMB * 1024 * 1024;
        // Tolak awal berdasarkan header, sebelum membaca fail besar ke dalam memori.
        if (Number(request.headers.get('Content-Length')) > maxBytes) {
          return json({ error: `Fail terlalu besar. Maksimum ${type.maxMB} MB.` }, 413);
        }
        const bytes = await request.arrayBuffer();
        if (bytes.byteLength === 0) return json({ error: 'Fail kosong.' }, 400);
        if (bytes.byteLength > maxBytes) {
          return json({ error: `Fail terlalu besar. Maksimum ${type.maxMB} MB.` }, 413);
        }

        // Nama fail asal diabaikan. Nama rawak elak dua fail bertembung nama.
        // Jenis fail disimpan sebagai metadata, untuk dihantar semula semasa GET /media.
        const key = `${crypto.randomUUID()}.${type.ext}`;
        await env.MEDIA.put(key, bytes, { metadata: { contentType } });
        return json({ key }, 201);
      }

      // /api/profiles/ali
      const profile = path.match(/^\/api\/profiles\/([^/]+)$/);
      if (profile) {
        const username = decodeURIComponent(profile[1]).trim();

        if (method === 'GET') {
          const row = await env.DB.prepare(
            'SELECT username, avatar_key FROM profiles WHERE username = ?'
          ).bind(username).first();
          return json(row ?? { username, avatar_key: null });
        }

        if (method === 'PUT') {
          const body = await request.json().catch(() => ({}));
          const avatarKey = String(body.avatar_key ?? '');
          if (!username || username.length > 30) {
            return json({ error: 'Nama mesti 1-30 aksara.' }, 400);
          }
          if (!KEY_PATTERN.test(avatarKey) || !IMAGE_KEY.test(avatarKey)) {
            return json({ error: 'Gambar profil tidak sah. Guna JPG, PNG, WebP atau GIF.' }, 400);
          }
          // Tiada profil = INSERT. Sudah ada = UPDATE (dipanggil "upsert").
          const row = await env.DB.prepare(
            `INSERT INTO profiles (username, avatar_key) VALUES (?, ?)
             ON CONFLICT(username) DO UPDATE SET avatar_key = excluded.avatar_key,
                                                 updated_at = datetime('now')
             RETURNING username, avatar_key`
          ).bind(username, avatarKey).first();
          return json(row);
        }
      }

      // /media/<key>: hantar fail dari KV ke browser.
      const media = path.match(/^\/media\/([^/]+)$/);
      if (media && method === 'GET') {
        const { value, metadata } = await env.MEDIA.getWithMetadata(media[1], 'arrayBuffer');
        if (!value) return json({ error: 'Fail tidak dijumpai.' }, 404);

        const headers = new Headers(CORS);
        headers.set('Content-Type', metadata?.contentType ?? 'application/octet-stream');
        headers.set('Accept-Ranges', 'bytes');
        headers.set('Cache-Control', 'public, max-age=31536000, immutable'); // key tak pernah berubah
        headers.set('X-Content-Type-Options', 'nosniff');

        // Video: browser minta sebahagian fail sahaja, contoh "Range: bytes=1000-1999",
        // supaya boleh lompat ke tengah video. Balas status 206 dengan bahagian itu.
        const range = request.headers.get('Range')?.match(/^bytes=(\d*)-(\d*)$/);
        if (range && (range[1] || range[2])) {
          const size = value.byteLength;
          const start = range[1] ? Number(range[1]) : Math.max(size - Number(range[2]), 0);
          const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
          if (start > end) {
            headers.set('Content-Range', `bytes */${size}`);
            return new Response(null, { status: 416, headers });
          }
          headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
          return new Response(value.slice(start, end + 1), { status: 206, headers });
        }
        return new Response(value, { headers });
      }

      // /api/posts/123/replies  atau  /api/posts/123/like
      const match = path.match(/^\/api\/posts\/(\d+)\/(replies|like)$/);
      if (match) {
        const [, id, action] = match;

        if (action === 'replies' && method === 'GET') {
          const { results } = await env.DB.prepare(
            `${POST_SELECT} WHERE p.parent_id = ? ORDER BY p.id ASC`
          ).bind(id).all();
          return json(results);
        }

        if (action === 'like' && method === 'POST') {
          const row = await env.DB.prepare(
            'UPDATE posts SET likes = likes + 1 WHERE id = ? RETURNING likes'
          ).bind(id).first();
          return row ? json(row) : json({ error: 'Post tidak wujud.' }, 404);
        }
      }

      return json({ error: 'Laluan tidak dijumpai.' }, 404);
    } catch (err) {
      // Ralat tak dijangka. Log penuh di server, mesej ringkas kepada browser.
      console.error(err);
      return json({ error: 'Ralat server.' }, 500);
    }
  },
};
