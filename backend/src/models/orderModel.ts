import { query } from '../db/index.js';

export interface OrderFilters {
  kundenr?: string;
  ordrenr?: string;
  startDate?: string;
  endDate?: string;
  firmaid?: string;
  lagernavn?: string;
  valutaid?: string;
  search?: string;
}

export const orderModel = {
  findAll: async (
    filters: OrderFilters, 
    user?: { role: string; kundenr?: string },
    pagination?: { limit: number; offset: number }
  ) => {
    let baseSql = `
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // If user is kunde, only show their orders
    if (user?.role === 'kunde' && user?.kundenr) {
      baseSql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(user.kundenr);
    } else if (filters.kundenr) {
      baseSql += ` AND o.kundenr = $${paramIndex++}`;
      params.push(filters.kundenr);
    }

    if (filters.ordrenr) {
      baseSql += ` AND o.ordrenr = $${paramIndex++}`;
      params.push(Number(filters.ordrenr));
    }

    if (filters.startDate) {
      baseSql += ` AND o.dato >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      baseSql += ` AND o.dato <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.firmaid) {
      baseSql += ` AND o.firmaid = $${paramIndex++}`;
      params.push(Number(filters.firmaid));
    }

    if (filters.lagernavn) {
      baseSql += ` AND o.lagernavn = $${paramIndex++}`;
      params.push(filters.lagernavn);
    }

    if (filters.valutaid) {
      baseSql += ` AND o.valutaid = $${paramIndex++}`;
      params.push(filters.valutaid);
    }

    if (filters.search) {
      baseSql += ` AND (
        o.kundeordreref ILIKE $${paramIndex} OR 
        o.kunderef ILIKE $${paramIndex} OR
        k.kundenavn ILIKE $${paramIndex}
      )`;
      params.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total ${baseSql}`;
    const countResult = await query(countSql, params);
    const total = parseInt(countResult.rows[0].total);

    // Get data
    let dataSql = `SELECT o.*, k.kundenavn, f.firmanavn ${baseSql}`;
    dataSql += ' ORDER BY o.dato DESC, o.ordrenr DESC';

    if (pagination) {
      dataSql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(pagination.limit, pagination.offset);
    }

    const result = await query(dataSql, params);
    
    return {
      data: result.rows,
      total
    };
  },

  findByOrderNr: async (ordrenr: number, user?: { role: string; kundenr?: string }) => {
    let sql = `
      SELECT o.*, k.kundenavn, f.firmanavn, l.lagernavn as lager_display
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      LEFT JOIN lager l ON o.lagernavn = l.lagernavn AND o.firmaid = l.firmaid
      WHERE o.ordrenr = $1
    `;
    const params: any[] = [ordrenr];

    // If user is kunde, only show their orders
    if (user?.role === 'kunde' && user?.kundenr) {
      sql += ` AND o.kundenr = $2`;
      params.push(user.kundenr);
    }

    const result = await query(sql, params);
    return result.rows[0];
  },

  findLines: async (ordrenr: number) => {
    const result = await query(
      `SELECT ol.*, v.varenavn, v.varegruppe,
              oh.henvisning1, oh.henvisning2, oh.henvisning3, oh.henvisning4, oh.henvisning5
       FROM ordrelinje ol
       LEFT JOIN vare v ON ol.varekode = v.varekode
       LEFT JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
       WHERE ol.ordrenr = $1
       ORDER BY ol.linjenr`,
      [ordrenr]
    );
    return result.rows;
  },

  searchReferences: async (q: string, user?: { role: string; kundenr?: string }) => {
    let sql = `
      SELECT DISTINCT o.*, k.kundenavn, f.firmanavn
      FROM ordre o
      LEFT JOIN kunde k ON o.kundenr = k.kundenr
      LEFT JOIN firma f ON o.firmaid = f.firmaid
      INNER JOIN ordrelinje ol ON o.ordrenr = ol.ordrenr
      INNER JOIN ordre_henvisning oh ON ol.ordrenr = oh.ordrenr AND ol.linjenr = oh.linjenr
      WHERE (
        oh.henvisning1 ILIKE $1 OR
        oh.henvisning2 ILIKE $1 OR
        oh.henvisning3 ILIKE $1 OR
        oh.henvisning4 ILIKE $1 OR
        oh.henvisning5 ILIKE $1
      )
    `;
    const params: any[] = [`%${q}%`];

    // If user is kunde, only show their orders
    if (user?.role === 'kunde' && user?.kundenr) {
      sql += ` AND o.kundenr = $2`;
      params.push(user.kundenr);
    }

    sql += ' ORDER BY o.dato DESC';

    const result = await query(sql, params);
    return result.rows;
  }
};
