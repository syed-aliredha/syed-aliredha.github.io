-- Commenter edit/delete keys, soft deletes, image uploads, and revision history.

ALTER TABLE comments ADD COLUMN edit_key_hash TEXT;  -- sha256 of the key held in the commenter's browser
ALTER TABLE comments ADD COLUMN edited_at INTEGER;
ALTER TABLE comments ADD COLUMN deleted_at INTEGER;  -- set when the commenter deletes their own comment
ALTER TABLE comments ADD COLUMN deleted_by TEXT;     -- 'author' (admin deletes are permanent)

CREATE TABLE IF NOT EXISTS images (
  id         TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  position   INTEGER NOT NULL,
  mime       TEXT NOT NULL,
  size       INTEGER NOT NULL,
  data       BLOB NOT NULL,
  ip_hash    TEXT,
  removed_at INTEGER,          -- set when the commenter removes it in an edit (kept for history)
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_comment ON images (comment_id, position);
CREATE INDEX IF NOT EXISTS idx_images_ip ON images (ip_hash, created_at);

-- Snapshot of a comment *before* each change, so edits and deletions can be reviewed at /admin.
CREATE TABLE IF NOT EXISTS revisions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id TEXT NOT NULL,
  action     TEXT NOT NULL,    -- 'edit' | 'delete' | 'restore'
  actor      TEXT NOT NULL,    -- 'author' | 'owner'
  content    TEXT NOT NULL,
  image_ids  TEXT NOT NULL,    -- JSON array of the image ids attached at the time
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revisions_comment ON revisions (comment_id, created_at);
