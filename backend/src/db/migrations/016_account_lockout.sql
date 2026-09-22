-- Per-account brute-force protection (progressive lockout):
--   failed_login_count    - consecutive failed password attempts (reset on success)
--   locked_until          - non-null while the account is locked out
--   last_failed_login_at  - observability / forensic support
-- See controllers/authController.ts and models/userModel.ts (recordFailedLogin).

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failed_login_at TIMESTAMPTZ;

-- Rollback:
-- ALTER TABLE users
--   DROP COLUMN IF EXISTS failed_login_count,
--   DROP COLUMN IF EXISTS locked_until,
--   DROP COLUMN IF EXISTS last_failed_login_at;
