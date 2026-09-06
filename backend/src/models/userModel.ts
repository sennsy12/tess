/**
 * User Model
 *
 * Handles all database operations for the `users` table.
 * Provides CRUD operations plus lookup helpers for authentication.
 *
 * @module models/userModel
 */
import { query } from '../db/index.js';
import type { SqlParams } from '../db/index.js';
import { extractWindowCountPage } from '../lib/paginatedQuery.js';
import { toIlikeContains } from '../lib/sqlSearch.js';

/** Full user record including the password hash (internal use only). */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  kundenr?: string;
  token_version?: number;
  created_at?: string;
}

/** User record without the password hash (safe for API responses). */
export interface UserPublic {
  id: number;
  username: string;
  role: string;
  kundenr?: string;
  created_at?: string;
  entra_oid?: string | null;
  entra_upn?: string | null;
  entra_linked_at?: string | null;
}

export const userModel = {
  /**
   * Look up a user by their username. Returns full record (incl. hash)
   * for authentication purposes.
   *
   * @param username - Exact username to match
   * @returns The matching user or `null` if not found
   */
  findByUsername: async (username: string): Promise<User | null> => {
    const result = await query(
      'SELECT id, username, password_hash, role, kundenr, token_version FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  },

  /**
   * Look up a user by their customer number (`kundenr`).
   *
   * @param kundenr - Customer number to match
   * @returns The matching user or `null`
   */
  findByKundenr: async (kundenr: string): Promise<User | null> => {
    const result = await query(
      'SELECT id, username, password_hash, role, kundenr, token_version FROM users WHERE kundenr = $1',
      [kundenr]
    );
    return result.rows[0] || null;
  },

  /**
   * Look up a user by their linked Microsoft Entra object ID.
   *
   * @param entraOid - Immutable Entra `oid` claim
   * @returns The matching user (incl. token_version for auth) or `null`
   */
  findByEntraOid: async (entraOid: string): Promise<User | null> => {
    const result = await query(
      'SELECT id, username, password_hash, role, kundenr, token_version FROM users WHERE entra_oid = $1',
      [entraOid]
    );
    return result.rows[0] || null;
  },

  /**
   * Current token version for a user. Embedded in access tokens and checked
   * on every authenticated request so a bump instantly invalidates old tokens.
   */
  getTokenVersion: async (id: number): Promise<number | null> => {
    const result = await query('SELECT token_version FROM users WHERE id = $1', [id]);
    return result.rows[0]?.token_version ?? null;
  },

  /**
   * Atomically increment the user's token version. All previously issued
   * access tokens for this user become invalid (claims no longer match).
   * Call after password changes or other credential resets.
   *
   * @returns The new token version
   */
  bumpTokenVersion: async (id: number): Promise<number> => {
    const result = await query(
      'UPDATE users SET token_version = token_version + 1 WHERE id = $1 RETURNING token_version',
      [id]
    );
    return result.rows[0]?.token_version ?? 0;
  },

  /**
   * Retrieve a single user by primary key (safe projection).
   *
   * @param id - User ID
   * @returns Public user record or `null`
   */
  findById: async (id: number): Promise<UserPublic | null> => {
    const result = await query(
      'SELECT id, username, role, kundenr, created_at, entra_oid, entra_upn, entra_linked_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /** Full record including password hash (auth only). */
  findByIdWithHash: async (id: number): Promise<User | null> => {
    const result = await query(
      'SELECT id, username, password_hash, role, kundenr FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * List all users with server-side pagination.
   *
   * @param page  - 1-indexed page number (default `1`)
   * @param limit - Maximum items per page (default `20`)
   * @returns Object containing the page of users and the total count
   */
  search: async (search: string, limit: number): Promise<UserPublic[]> => {
    const result = await query(
      `SELECT id, username, role, kundenr, created_at, entra_oid, entra_upn, entra_linked_at
       FROM users
       WHERE username ILIKE $1
       ORDER BY username
       LIMIT $2`,
      [toIlikeContains(search), limit],
    );
    return result.rows;
  },

  getAll: async (page: number = 1, limit: number = 20): Promise<{ data: UserPublic[]; total: number }> => {
    const offset = (page - 1) * limit;
    const result = await query(
      `SELECT id, username, role, kundenr, created_at, entra_oid, entra_upn, entra_linked_at,
              COUNT(*) OVER()::int AS _total_count
       FROM users
       ORDER BY id ASC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const { data, total } = extractWindowCountPage(result.rows);
    return { data: data as UserPublic[], total };
  },

  /**
   * Insert a new user into the database.
   *
   * @param username     - Unique username
   * @param passwordHash - bcrypt hash of the user's password
   * @param role         - One of `'admin'`, `'kunde'`, or `'analyse'`
   * @param kundenr      - Optional customer number (only relevant for `'kunde'` role)
   * @returns The newly created user record (safe projection)
   */
  create: async (username: string, passwordHash: string, role: string, kundenr?: string): Promise<UserPublic> => {
    const result = await query(
      `INSERT INTO users (username, password_hash, role, kundenr)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, kundenr, created_at`,
      [username, passwordHash, role, kundenr || null]
    );
    return result.rows[0];
  },

  /**
   * Partially update user fields. Only provided keys are modified.
   * Builds a dynamic `SET` clause so unchanged columns are untouched.
   *
   * @param id     - User ID to update
   * @param fields - Object with optional fields to change
   * @returns The updated user record, or `null` if not found
   */
  update: async (id: number, fields: { username?: string; passwordHash?: string; role?: string; kundenr?: string | null }): Promise<UserPublic | null> => {
    const setClauses: string[] = [];
    const values: SqlParams = [];
    let paramIndex = 1;

    if (fields.username !== undefined) {
      setClauses.push(`username = $${paramIndex++}`);
      values.push(fields.username);
    }
    if (fields.passwordHash !== undefined) {
      setClauses.push(`password_hash = $${paramIndex++}`);
      values.push(fields.passwordHash);
    }
    if (fields.role !== undefined) {
      setClauses.push(`role = $${paramIndex++}`);
      values.push(fields.role);
    }
    if (fields.kundenr !== undefined) {
      setClauses.push(`kundenr = $${paramIndex++}`);
      values.push(fields.kundenr);
    }

    if (setClauses.length === 0) return userModel.findById(id);

    values.push(id);
    const result = await query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, username, role, kundenr, created_at`,
      values
    );
    return result.rows[0] || null;
  },

  /**
   * Permanently remove a user by ID.
   *
   * @param id - User ID to delete
   * @returns `true` if a row was actually deleted, `false` otherwise
   */
  delete: async (id: number): Promise<boolean> => {
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  /**
   * Link a Microsoft Entra account to a local user (admin-only operation).
   * The `entra_oid` UNIQUE constraint guarantees one Microsoft account maps
   * to at most one local user — a duplicate raises PG 23505 (→ HTTP 409).
   *
   * @param id       - Local user ID
   * @param entraOid - Immutable Entra `oid` claim
   * @param entraUpn - Human identifier (preferred_username/email/upn) for display
   * @returns The updated user record, or `null` if not found
   */
  linkEntra: async (id: number, entraOid: string, entraUpn?: string): Promise<UserPublic | null> => {
    const result = await query(
      `UPDATE users
       SET entra_oid = $2, entra_upn = $3, entra_linked_at = NOW()
       WHERE id = $1
       RETURNING id, username, role, kundenr, created_at, entra_oid, entra_upn, entra_linked_at`,
      [id, entraOid, entraUpn ?? null]
    );
    return result.rows[0] || null;
  },

  /**
   * Remove the Microsoft Entra link from a local user. Local password login
   * is unaffected; previously issued tokens stay valid until they expire or
   * the token version is bumped.
   */
  unlinkEntra: async (id: number): Promise<UserPublic | null> => {
    const result = await query(
      `UPDATE users
       SET entra_oid = NULL, entra_upn = NULL, entra_linked_at = NULL
       WHERE id = $1
       RETURNING id, username, role, kundenr, created_at, entra_oid, entra_upn, entra_linked_at`,
      [id]
    );
    return result.rows[0] || null;
  },
};
