import { query } from '../db/index.js';

export const productModel = {
  findAll: async (varegruppe?: string) => {
    let sql = 'SELECT * FROM vare';
    const params: any[] = [];
    
    if (varegruppe) {
      sql += ' WHERE varegruppe = $1';
      params.push(varegruppe);
    }
    
    sql += ' ORDER BY varenavn';
    
    const result = await query(sql, params);
    return result.rows;
  },

  findGroups: async () => {
    const result = await query('SELECT DISTINCT varegruppe FROM vare WHERE varegruppe IS NOT NULL ORDER BY varegruppe');
    return result.rows.map(r => r.varegruppe);
  },

  findByCode: async (varekode: string) => {
    const result = await query('SELECT * FROM vare WHERE varekode = $1', [varekode]);
    return result.rows[0];
  }
};
