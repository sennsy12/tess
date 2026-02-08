/**
 * User Model
 *
 * Handles all database operations for the `users` table.
 * Provides CRUD operations plus lookup helpers for authentication.
 *
 * @module models/userModel
 */
import { query } from '../db/index.js';

/** Full user record including the password hash (internal use only). */
export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  kundenr?: string;
  created_at?: string;
}

/** User record without the password hash (safe for API responses). */
export interface UserPublic {
  id: number;
  username: string;
  role: string;
  kundenr?: string;
  created_at?: string;
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
      'SELECT id, username, password_hash, role, kundenr FROM users WHERE username = $1',
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
      'SELECT id, username, password_hash, role, kundenr FROM users WHERE kundenr = $1',
      [kundenr]
    );
    return result.rows[0] || null;
  },

  /**
   * Retrieve a single user by primary key (safe projection).
   *
   * @param id - User ID
   * @returns Public user record or `null`
   */
  findById: async (id: number): Promise<UserPublic | null> => {
    const result = await query(
      'SELECT id, username, role, kundenr, created_at FROM users WHERE id = $1',
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
  getAll: async (page: number = 1, limit: number = 20): Promise<{ data: UserPublic[]; total: number }> => {
    const offset = (page - 1) * limit;
    const [countResult, dataResult] = await Promise.all([
      query('SELECT COUNT(*) AS total FROM users'),
      query(
        'SELECT id, username, role, kundenr, created_at FROM users ORDER BY id ASC LIMIT $1 OFFSET $2',
        [limit, offset]
      ),
    ]);
    return {
      data: dataResult.rows,
      total: parseInt(countResult.rows[0].total, 10),
    };
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
    const values: any[] = [];
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
};
