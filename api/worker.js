// Kicau: backend API (Cloudflare Worker). Pensyarah deploy SEKALI; pelajar tak perlu sentuh.
//
// Aliran:  frontend pelajar --fetch()--> Worker (fail ini) --SQL--> D1 --> JSON --> frontend
//
// env.DB ialah sambungan D1 (lihat "d1_databases" dalam wrangler.jsonc).
//
// API:
//   GET  /api/posts               senarai post utama (terbaru dahulu)
//   POST /api/posts               cipta post / reply  { username, content, parent_id? }
//   GET  /api/posts/:id/replies   senarai reply bagi satu post
//   POST /api/posts/:id/like      tambah 1 like

// CORS: benarkan halaman dari mana-mana tempat (termasuk fail index.html yang
// dibuka terus dari laptop pelajar) memanggil API ini.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: CORS });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;

    // Browser hantar OPTIONS dahulu ("preflight") untuk tanya kebenaran CORS.
    if (method === 'OPTIONS') return new Response(null, { headers: CORS });

    try {
      if (url.pathname === '/api/posts' && method === 'GET') {
        // Subquery kira bilangan reply bagi setiap post.
        const { results } = await env.DB.prepare(
          `SELECT p.*,
                  (SELECT COUNT(*) FROM posts r WHERE r.parent_id = p.id) AS reply_count
           FROM posts p
           WHERE p.parent_id IS NULL
           ORDER BY p.id DESC
           LIMIT 50`
        ).all();
        return json(results);
      }

      if (url.pathname === '/api/posts' && method === 'POST') {
        // Jangan percaya data dari browser: semak semula di server.
        const body = await request.json().catch(() => ({}));
        const username = String(body.username ?? '').trim();
        const content = String(body.content ?? '').trim();
        const parentId = body.parent_id ?? null;

        if (!username || username.length > 30) {
          return json({ error: 'Nama mesti 1-30 aksara.' }, 400);
        }
        if (!content || content.length > 500) {
          return json({ error: 'Post mesti 1-500 aksara.' }, 400);
        }
        if (parentId !== null && !Number.isInteger(parentId)) {
          return json({ error: 'parent_id tidak sah.' }, 400);
        }

        // Guna tanda ? dan bind(). JANGAN cantum input terus ke dalam string SQL:
        // itu membuka ruang SQL injection.
        const post = await env.DB.prepare(
          'INSERT INTO posts (username, content, parent_id) VALUES (?, ?, ?) RETURNING *'
        ).bind(username, content, parentId).first();
        return json(post, 201);
      }

      // /api/posts/123/replies  atau  /api/posts/123/like
      const match = url.pathname.match(/^\/api\/posts\/(\d+)\/(replies|like)$/);
      if (match) {
        const [, id, action] = match;

        if (action === 'replies' && method === 'GET') {
          const { results } = await env.DB.prepare(
            'SELECT * FROM posts WHERE parent_id = ? ORDER BY id ASC'
          ).bind(id).all();
          return json(results);
        }

        if (action === 'like' && method === 'POST') {
          const row = await env.DB.prepare(
            'UPDATE posts SET likes = likes + 1 WHERE id = ? RETURNING likes'
          ).bind(id).first();
          return row
            ? json(row)
            : json({ error: 'Post tidak wujud.' }, 404);
        }
      }

      return json({ error: 'Laluan tidak dijumpai.' }, 404);
    } catch (err) {
      // Ralat tak dijangka (contoh: reply kepada post yang tak wujud).
      // Log penuh di server, mesej ringkas kepada browser.
      console.error(err);
      return json({ error: 'Ralat server.' }, 500);
    }
  },
};
