import { query } from '../db/index.js';

export interface SavedReport {
  id: number;
  user_id: number;
  name: string;
  config: any;
  created_at: Date;
}

export const reportModel = {
  create: async (userId: number, name: string, config: any) => {
    const result = await query(
      'INSERT INTO saved_reports (user_id, name, config) VALUES ($1, $2, $3) RETURNING *',
      [userId, name, config]
    );
    return result.rows[0];
  },

  getByUser: async (userId: number) => {
    const result = await query(
      'SELECT * FROM saved_reports WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    return result.rows;
  },

  delete: async (reportId: number, userId: number) => {
    const result = await query(
      'DELETE FROM saved_reports WHERE id = $1 AND user_id = $2 RETURNING id',
      [reportId, userId]
    );
    return (result.rowCount ?? 0) > 0;
  },
};
