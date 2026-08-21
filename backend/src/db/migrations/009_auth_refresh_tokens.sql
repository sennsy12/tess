-- Authentication hardening:
-- 1. token_version on users — embedded in JWT access tokens and bumped on
--    password change so previously issued tokens are rejected immediately.
-- 2. refresh_tokens table — server-side, hashed refresh tokens with
--    rotation support (old token revoked when a new one is issued).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- SHA-256 hex of the opaque token; the raw token is never stored
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  -- Set when this token was rotated into a successor (reuse detection aid)
  replaced_by_hash CHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
