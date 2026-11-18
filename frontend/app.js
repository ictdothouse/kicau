// Kicau: frontend.
// Data teks (post, like, reply) disimpan dalam D1. Fail (gambar, video) disimpan dalam KV.
// Kedua-duanya dicapai melalui API (Cloudflare Worker) menggunakan fetch().

// URL API. Sekarang: server local pensyarah. Selepas deploy, tukar kepada URL Worker
// (contoh https://kicau.nama-anda.workers.dev) sebelum beri fail ini kepada pelajar.
const API = 'http://127.0.0.1:8787';

const feed = document.querySelector('#feed');
const form = document.querySelector('#post-form');
const counter = document.querySelector('#counter');
const template = document.querySelector('#post-template');
const nameInput = form.elements.username;
const contentInput = form.elements.content;
const mediaInput = form.elements.media;
const preview = document.querySelector('#media-preview');
const myAvatar = document.querySelector('#my-avatar');
const avatarInput = document.querySelector('#avatar-file');

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

// Muat naik satu fail ke KV melalui API. Fail dihantar terus sebagai body,
// dan Content-Type memberitahu server jenis fail. Pulangkan "key" (nama fail dalam KV).
async function upload(file) {
  const res = await fetch(API + '/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.key;
}

// Alamat penuh untuk memaparkan fail dari KV.
function mediaUrl(key) {
  return `${API}/media/${key}`;
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

// Avatar: gambar profil jika ada. Jika tiada, huruf pertama nama atas warna.
function paintAvatar(el, name, avatarKey) {
  el.querySelector('span').textContent = (name || '?')[0].toUpperCase();
  el.style.background = colorFor(name || '?');
  const img = el.querySelector('img');
  img.hidden = !avatarKey;
  if (avatarKey) img.src = mediaUrl(avatarKey);
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
  paintAvatar(el.querySelector('.avatar'), post.username, post.avatar_key);

  // Media: D1 simpan key sahaja. Fail sebenar diambil dari KV melalui /media/<key>.
  if (post.media_key) {
    const isVideo = /\.(mp4|webm)$/.test(post.media_key);
    const media = el.querySelector(isVideo ? 'video.media' : 'img.media');
    media.src = mediaUrl(post.media_key);
    media.hidden = false;
  }

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

// Papar gambar profil milik nama yang ditaip.
async function loadMyAvatar() {
  const name = nameInput.value.trim();
  if (!name) return paintAvatar(myAvatar, '', null);
  const profile = await api(`/api/profiles/${encodeURIComponent(name)}`);
  paintAvatar(myAvatar, name, profile.avatar_key);
}

// Pratonton fail yang dipilih. URL.createObjectURL beri alamat sementara
// untuk fail yang masih berada dalam komputer pengguna (belum dimuat naik).
function showPreview() {
  const file = mediaInput.files[0];
  preview.replaceChildren();
  preview.hidden = !file;
  if (!file) return;

  const media = document.createElement(file.type.startsWith('video/') ? 'video' : 'img');
  media.src = URL.createObjectURL(file);
  media.controls = true;
  media.alt = 'Pratonton';

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'ghost';
  remove.textContent = '✕ Buang';
  remove.addEventListener('click', () => {
    mediaInput.value = '';
    showPreview();
  });

  preview.append(media, remove);
}

// ---------- Event ----------

contentInput.addEventListener('input', () => {
  counter.textContent = `${contentInput.value.length}/500`;
});

mediaInput.addEventListener('change', showPreview);

nameInput.addEventListener('change', loadMyAvatar);

// Tukar gambar profil: 1) muat naik ke KV, 2) simpan key dalam profil (D1).
avatarInput.addEventListener('change', async () => {
  const file = avatarInput.files[0];
  avatarInput.value = ''; // supaya fail yang sama boleh dipilih semula
  if (!file || !nameInput.reportValidity()) return;
  try {
    const name = nameInput.value.trim();
    const key = await upload(file);
    await api(`/api/profiles/${encodeURIComponent(name)}`, 'PUT', { avatar_key: key });
    localStorage.setItem('username', name);
    paintAvatar(myAvatar, name, key);
    loadFeed(); // gambar baru muncul pada semua post anda
  } catch (err) {
    alert(err.message);
  }
});

form.addEventListener('submit', async (event) => {
  event.preventDefault(); // halang browser reload halaman
  const button = form.querySelector('.primary');
  button.disabled = true;
  try {
    // 1) Jika ada fail, muat naik ke KV dahulu dan dapatkan key.
    let mediaKey = null;
    if (mediaInput.files[0]) {
      button.textContent = 'Memuat naik...';
      mediaKey = await upload(mediaInput.files[0]);
    }
    // 2) Simpan post dalam D1 bersama key fail itu.
    await api('/api/posts', 'POST', {
      username: nameInput.value,
      content: contentInput.value,
      media_key: mediaKey,
    });
    localStorage.setItem('username', nameInput.value.trim());
    contentInput.value = '';
    counter.textContent = '0/500';
    mediaInput.value = '';
    showPreview();
    await loadFeed();
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
    button.textContent = 'Post';
  }
});

document.querySelector('#refresh').addEventListener('click', loadFeed);

loadFeed();
loadMyAvatar();
