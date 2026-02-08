import { query } from '../db/index.js';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  kundenr?: string;
  created_at?: string;
}

/** User record without the password hash (safe for API responses) */
export interface UserPublic {
  id: number;
  username: string;
  role: string;
  kundenr?: string;
  created_at?: string;
}

export const userModel = {
  findByUsername: async (username: string): Promise<User | null> => {
    const result = await query(
      'SELECT id, username, password_hash, role, kundenr FROM users WHERE username = $1',
      [username]
    );
    return result.rows[0] || null;
  },

  findByKundenr: async (kundenr: string): Promise<User | null> => {
    const result = await query(
      'SELECT id, username, password_hash, role, kundenr FROM users WHERE kundenr = $1',
      [kundenr]
    );
    return result.rows[0] || null;
  },

  findById: async (id: number): Promise<UserPublic | null> => {
    const result = await query(
      'SELECT id, username, role, kundenr, created_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },

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

  create: async (username: string, passwordHash: string, role: string, kundenr?: string): Promise<UserPublic> => {
    const result = await query(
      `INSERT INTO users (username, password_hash, role, kundenr)
       VALUES ($1, $2, $3, $4)
       RETURNING id, username, role, kundenr, created_at`,
      [username, passwordHash, role, kundenr || null]
    );
    return result.rows[0];
  },

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

  delete: async (id: number): Promise<boolean> => {
    const result = await query('DELETE FROM users WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },
};
