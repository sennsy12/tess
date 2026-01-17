import { query } from '../db/index.js';

export const orderLineModel = {
  findByOrderNr: async (ordrenr: number, options?: { page?: number; limit?: number }) => {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM ordrelinje WHERE ordrenr = $1',
      [ordrenr]
    );
    const total = parseInt(countResult.rows[0].total, 10);

    // Get paginated data
    const result = await query(
      `SELECT ol.*, v.varenavn, v.varegruppe,
              oh.henvisning1, oh.henvisning2, oh.henvisning3, oh.henvisning4, oh.henvisning5
       FROM ordrelinje ol
       LEFT JOIN vare v ON ol.varekode = v.varekode
       LEFT JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
       WHERE ol.ordrenr = $1
       ORDER BY ol.linjenr
       LIMIT $2 OFFSET $3`,
      [ordrenr, limit, offset]
    );

    return {
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  },

  create: async (data: { ordrenr: number; varekode: string; antall: number; enhet: string; nettpris: number; linjestatus?: number }) => {
    // Get next line number for this order
    const maxLineResult = await query(
      'SELECT COALESCE(MAX(linjenr), 0) + 1 as next_linjenr FROM ordrelinje WHERE ordrenr = $1',
      [data.ordrenr]
    );
    const linjenr = maxLineResult.rows[0].next_linjenr;
    const linjesum = data.antall * data.nettpris;

    const result = await query(
      `INSERT INTO ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [linjenr, data.ordrenr, data.varekode, data.antall, data.enhet, data.nettpris, linjesum, data.linjestatus || 1]
    );
    return result.rows[0];
  },

  update: async (ordrenr: number, linjenr: number, data: { varekode: string; antall: number; enhet: string; nettpris: number; linjestatus: number }) => {
    const linjesum = data.antall * data.nettpris;

    const result = await query(
      `UPDATE ordrelinje 
       SET varekode = $1, antall = $2, enhet = $3, nettpris = $4, linjesum = $5, linjestatus = $6
       WHERE ordrenr = $7 AND linjenr = $8
       RETURNING *`,
      [data.varekode, data.antall, data.enhet, data.nettpris, linjesum, data.linjestatus, ordrenr, linjenr]
    );
    return result.rows[0];
  },

  delete: async (ordrenr: number, linjenr: number) => {
    // First delete any references
    await query(
      'DELETE FROM ordre_henvisning WHERE ordrenr = $1 AND linjenr = $2',
      [ordrenr, linjenr]
    );

    const result = await query(
      'DELETE FROM ordrelinje WHERE ordrenr = $1 AND linjenr = $2 RETURNING *',
      [ordrenr, linjenr]
    );
    return result.rows[0];
  },

  updateOrderSum: async (ordrenr: number) => {
    await query(
      `UPDATE ordre SET sum = COALESCE((SELECT SUM(linjesum) FROM ordrelinje WHERE ordrenr = $1), 0) WHERE ordrenr = $1`,
      [ordrenr]
    );
  },

  updateReferences: async (ordrenr: number, linjenr: number, refs: { henvisning1?: string; henvisning2?: string; henvisning3?: string; henvisning4?: string; henvisning5?: string }) => {
    const result = await query(
      `INSERT INTO ordre_henvisning (ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (ordrenr, linjenr) DO UPDATE SET
         henvisning1 = EXCLUDED.henvisning1,
         henvisning2 = EXCLUDED.henvisning2,
         henvisning3 = EXCLUDED.henvisning3,
         henvisning4 = EXCLUDED.henvisning4,
         henvisning5 = EXCLUDED.henvisning5
       RETURNING *`,
      [ordrenr, linjenr, refs.henvisning1, refs.henvisning2, refs.henvisning3, refs.henvisning4, refs.henvisning5]
    );
    return result.rows[0];
  }
};
