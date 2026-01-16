import { query } from '../db/index.js';

export const customerModel = {
  findAll: async () => {
    const result = await query('SELECT * FROM kunde ORDER BY kundenavn');
    return result.rows;
  },

  findByNumber: async (kundenr: string) => {
    const result = await query('SELECT * FROM kunde WHERE kundenr = $1', [kundenr]);
    return result.rows[0];
  }
};
