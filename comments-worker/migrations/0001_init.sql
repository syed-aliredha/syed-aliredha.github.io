-- Initial comments table (already applied to the live DB via the old schema.sql).
CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  page_id    TEXT NOT NULL,
  page_url   TEXT,
  page_title TEXT,
  parent_id  TEXT,
  nickname   TEXT NOT NULL,
  email      TEXT,              -- never returned by the public API
  content    TEXT NOT NULL,
  by_owner   INTEGER NOT NULL DEFAULT 0,
  approved   INTEGER NOT NULL DEFAULT 0,
  ip_hash    TEXT,              -- salted hash, only used for rate limiting
  created_at INTEGER NOT NULL   -- ms since epoch
);

CREATE INDEX IF NOT EXISTS idx_comments_page ON comments (page_id, approved, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments (parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_ip ON comments (ip_hash, created_at);
