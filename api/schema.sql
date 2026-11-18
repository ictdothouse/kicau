-- Skema database Kicau (Bahagian 2).
-- posts    : post biasa DAN reply. Reply = post yang ada parent_id.
-- profiles : gambar profil, ikut nama pengguna.
-- Fail gambar/video TIDAK disimpan dalam D1. D1 hanya simpan "key" (nama fail);
-- fail sebenar berada dalam KV.
-- Selamat dijalankan berulang kali (IF NOT EXISTS): data sedia ada tidak terpadam.

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL CHECK (length(username) BETWEEN 1 AND 30),
  content    TEXT    NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  parent_id  INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  media_key  TEXT,                                       -- key fail dalam KV, atau NULL
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))  -- masa UTC
);

-- Index supaya carian reply bagi satu post laju.
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);

CREATE TABLE IF NOT EXISTS profiles (
  username   TEXT PRIMARY KEY,
  avatar_key TEXT NOT NULL,                              -- key gambar dalam KV
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Naik taraf dari Bahagian 1 (table posts sudah wujud tanpa media_key)?
-- Jalankan SEKALI sahaja sebelum fail ini:
--   ALTER TABLE posts ADD COLUMN media_key TEXT;
