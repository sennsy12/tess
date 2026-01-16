import { query } from '../db/index.js';

export interface User {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  kundenr?: string;
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
  }
};
