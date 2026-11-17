-- Skema database Kicau.
-- Satu table sahaja: post biasa DAN reply disimpan dalam table yang sama.
-- Reply = post yang ada parent_id (merujuk id post asal).
-- Selamat dijalankan berulang kali (IF NOT EXISTS): data sedia ada tidak terpadam.

CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT    NOT NULL CHECK (length(username) BETWEEN 1 AND 30),
  content    TEXT    NOT NULL CHECK (length(content) BETWEEN 1 AND 500),
  parent_id  INTEGER REFERENCES posts(id) ON DELETE CASCADE,
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))  -- masa UTC
);

-- Index supaya carian reply bagi satu post laju.
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_id);
