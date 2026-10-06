CREATE TABLE IF NOT EXISTS invitations (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  code_hash TEXT NOT NULL UNIQUE,
  contact TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  invitation_id TEXT NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  attending TEXT NOT NULL DEFAULT 'pending' CHECK (attending IN ('pending','yes','no')),
  dietary TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS guests_invitation ON guests(invitation_id);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
