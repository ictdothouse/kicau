// Kicau: frontend.
// Semua data datang dari API (Cloudflare Worker + D1) melalui fetch().

// URL API. Sekarang: server local pensyarah. Selepas deploy, tukar kepada URL Worker
// (contoh https://kicau.nama-anda.workers.dev) sebelum beri fail ini kepada pelajar.
const API = 'http://127.0.0.1:8787';

const feed = document.querySelector('#feed');
const form = document.querySelector('#post-form');
const counter = document.querySelector('#counter');
const template = document.querySelector('#post-template');
const nameInput = form.elements.username;
const contentInput = form.elements.content;

// Ingat nama pengguna dalam browser supaya tak perlu taip setiap kali.
nameInput.value = localStorage.getItem('username') ?? '';

// ---------- Bantuan ----------

// Panggil API dan pulangkan JSON. Baling ralat jika server balas status gagal.
async function api(path, method = 'GET', body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// SQLite simpan masa UTC tanpa zon, contoh "2026-11-17 08:30:00".
// Tukar kepada "5 minit lalu", "semalam", dll.
const rtf = new Intl.RelativeTimeFormat('ms', { numeric: 'auto' });
function timeAgo(sqliteTime) {
  const seconds = (new Date(sqliteTime.replace(' ', 'T') + 'Z') - Date.now()) / 1000;
  const units = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit);
  }
  return 'baru sahaja';
}

// Warna avatar tetap untuk setiap nama (nama sama = warna sama).
function colorFor(name) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  return `hsl(${hash} 55% 45%)`;
}

// ---------- Paparan ----------

// Bina elemen <li> untuk satu post daripada <template>.
function renderPost(post) {
  const el = template.content.firstElementChild.cloneNode(true);

  // Guna textContent, BUKAN innerHTML. Jika pengguna taip <script>,
  // ia dipaparkan sebagai teks biasa dan tidak dijalankan (elak XSS).
  el.querySelector('.username').textContent = post.username;
  el.querySelector('.time').textContent = timeAgo(post.created_at);
  el.querySelector('.content').textContent = post.content;

  const avatar = el.querySelector('.avatar');
  avatar.textContent = post.username[0].toUpperCase();
  avatar.style.background = colorFor(post.username);

  // Butang like
  const likeBtn = el.querySelector('.like');
  likeBtn.querySelector('.count').textContent = post.likes;
  likeBtn.addEventListener('click', async () => {
    const { likes } = await api(`/api/posts/${post.id}/like`, 'POST');
    likeBtn.querySelector('.count').textContent = likes;
    likeBtn.classList.add('liked');
  });

  // Reply hanya satu tingkat: reply tidak boleh dibalas lagi.
  const replyBtn = el.querySelector('.reply-toggle');
  const thread = el.querySelector('.thread');
  if (post.parent_id) {
    replyBtn.remove();
    thread.remove();
    return el;
  }

  const replyList = thread.querySelector('.replies');
  const replyForm = thread.querySelector('.reply-form');
  replyBtn.querySelector('.count').textContent = post.reply_count;

  async function loadReplies() {
    const replies = await api(`/api/posts/${post.id}/replies`);
    replyList.replaceChildren(...replies.map(renderPost));
    replyBtn.querySelector('.count').textContent = replies.length;
  }

  replyBtn.addEventListener('click', () => {
    thread.hidden = !thread.hidden;
    if (!thread.hidden) loadReplies();
  });

  replyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!nameInput.reportValidity()) return; // perlu nama dahulu
    try {
      await api('/api/posts', 'POST', {
        username: nameInput.value,
        content: replyForm.elements.content.value,
        parent_id: post.id,
      });
      replyForm.reset();
      loadReplies();
    } catch (err) {
      alert(err.message);
    }
  });

  return el;
}

async function loadFeed() {
  try {
    const posts = await api('/api/posts');
    feed.replaceChildren(...posts.map(renderPost));
  } catch (err) {
    alert('Gagal muat post: ' + err.message);
  }
}

// ---------- Event ----------

contentInput.addEventListener('input', () => {
  counter.textContent = `${contentInput.value.length}/500`;
});

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // halang browser reload halaman
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await api('/api/posts', 'POST', {
      username: nameInput.value,
      content: contentInput.value,
    });
    localStorage.setItem('username', nameInput.value.trim());
    contentInput.value = '';
    counter.textContent = '0/500';
    await loadFeed();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector('#refresh').addEventListener('click', loadFeed);

loadFeed();
