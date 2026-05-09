CREATE TABLE IF NOT EXISTS pro_keys (
  code TEXT PRIMARY KEY,
  daily_limit INTEGER,
  is_unlimited INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  note TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pro_keys_active ON pro_keys(active);
