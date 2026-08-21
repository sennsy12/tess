/**
 * Refresh Token Model
 *
 * Server-side refresh token storage for the auth refresh flow.
 *
 * Security properties:
 * - Only SHA-256 hashes are persisted; a database leak exposes nothing usable.
 * - Tokens rotate on every use: the presented token is revoked atomically
 *   with issuance of its successor, limiting the value of stolen tokens.
 * - Expired/revoked tokens are rejected; expired rows are garbage-collected
 *   lazily on issue.
 *
 * @module models/refreshTokenModel
 */
import crypto from 'crypto';
import { query, transaction } from '../db/index.js';

/** Refresh tokens live for 7 days. */
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Opaque token length in bytes (hex-encoded → 64 chars). */
const TOKEN_BYTES = 32;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
}

export interface IssuedRefreshToken {
  /** Raw token — returned to the client exactly once, never stored. */
  token: string;
  expiresAt: Date;
}

export const refreshTokenModel = {
  /**
   * Issue a new refresh token for a user. Also opportunistically removes
   * this user's already-expired rows to keep the table small.
   */
  create: async (userId: number): Promise<IssuedRefreshToken> => {
    const raw = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, hashToken(raw), expiresAt]
    );
    // Lazy GC of this user's dead rows (cheap, indexed on user_id)
    await query(
      `DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()`,
      [userId]
    );
    return { token: raw, expiresAt };
  },

  /**
   * Look up a valid (present, unrevoked, unexpired) token by its raw value.
   *
   * @returns The row's id and userId, or `null` when invalid for any reason
   */
  findValidByToken: async (
    raw: string
  ): Promise<{ id: number; userId: number } | null> => {
    const result = await query(
      `SELECT id, user_id FROM refresh_tokens
       WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [hashToken(raw)]
    );
    return result.rows[0] ? { id: result.rows[0].id, userId: result.rows[0].user_id } : null;
  },

  /**
   * Atomically consume a valid refresh token and issue its successor
   * (rotation). If validation fails inside the transaction nothing changes.
   *
   * @returns The newly issued token plus owning userId, or `null` when the
   *          presented token is invalid/revoked/expired
   */
  rotate: async (
    raw: string
  ): Promise<(IssuedRefreshToken & { userId: number }) | null> => {
    const newRaw = crypto.randomBytes(TOKEN_BYTES).toString('hex');
    const newHash = hashToken(newRaw);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    return transaction(async (client) => {
      // FOR UPDATE prevents two concurrent requests from both consuming the token
      const current = await client.query(
        `SELECT id, user_id FROM refresh_tokens
         WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > NOW()
         FOR UPDATE`,
        [hashToken(raw)]
      );
      if (current.rows.length === 0) return null;

      const { id, user_id: userId } = current.rows[0];
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_hash = $2 WHERE id = $1`,
        [id, newHash]
      );
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, newHash, expiresAt]
      );
      return { token: newRaw, expiresAt, userId };
    });
  },

  /** Revoke a single token (logout). Idempotent. */
  revoke: async (raw: string): Promise<boolean> => {
    const result = await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL`,
      [hashToken(raw)]
    );
    return (result.rowCount ?? 0) > 0;
  },

  /** Revoke every refresh token belonging to a user (password reset etc.). */
  revokeAllForUser: async (userId: number): Promise<number> => {
    const result = await query(
      `UPDATE refresh_tokens SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
    return result.rowCount ?? 0;
  },
};
