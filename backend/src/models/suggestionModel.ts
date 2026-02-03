import { query } from '../db/index.js';

export const suggestionModel = {
  search: async (q: string, user?: { role: string; kundenr?: string }) => {
    const searchTerm = `%${q.toLowerCase()}%`;
    
    // Use parameterized query for kunde filter (prevents SQL injection)
    const isKundeUser = user?.role === 'kunde' && user?.kundenr;
    const kundenrParam = isKundeUser ? user.kundenr : null;
    
    // Search across multiple fields with safe parameterized queries
    const result = await query(`
      SELECT DISTINCT suggestion, type, value FROM (
        -- Customer IDs (kundenr)
        SELECT k.kundenr as suggestion, 'kunde' as type, k.kundenr as value
        FROM kunde k
        WHERE LOWER(k.kundenr) LIKE $1
        
        UNION

        -- Customer names
        SELECT k.kundenavn as suggestion, 'kunde' as type, k.kundenr as value
        FROM kunde k
        JOIN ordre o ON o.kundenr = k.kundenr
        WHERE LOWER(k.kundenavn) LIKE $1 AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Order references
        SELECT o.kundeordreref as suggestion, 'referanse' as type, o.kundeordreref as value
        FROM ordre o
        WHERE LOWER(o.kundeordreref) LIKE $1 AND o.kundeordreref IS NOT NULL AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Customer references
        SELECT o.kunderef as suggestion, 'kunderef' as type, o.kunderef as value
        FROM ordre o
        WHERE LOWER(o.kunderef) LIKE $1 AND o.kunderef IS NOT NULL AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Firma names
        SELECT f.firmanavn as suggestion, 'firma' as type, f.firmanavn as value
        FROM firma f
        JOIN ordre o ON o.firmaid = f.firmaid
        WHERE LOWER(f.firmanavn) LIKE $1 AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Lager names
        SELECT l.lagernavn as suggestion, 'lager' as type, l.lagernavn as value
        FROM lager l
        JOIN ordre o ON l.lagernavn = l.lagernavn
        WHERE LOWER(l.lagernavn) LIKE $1 AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Product names
        SELECT v.varenavn as suggestion, 'vare' as type, v.varenavn as value
        FROM vare v
        JOIN ordrelinje ol ON ol.varekode = v.varekode
        JOIN ordre o ON o.ordrenr = ol.ordrenr
        WHERE LOWER(v.varenavn) LIKE $1 AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Henvisning1
        SELECT oh.henvisning1 as suggestion, 'henvisning' as type, oh.henvisning1 as value
        FROM ordre_henvisning oh
        JOIN ordre o ON o.ordrenr = oh.ordrenr
        WHERE LOWER(oh.henvisning1) LIKE $1 AND oh.henvisning1 IS NOT NULL AND ($2::text IS NULL OR o.kundenr = $2)
        
        UNION
        
        -- Henvisning2
        SELECT oh.henvisning2 as suggestion, 'henvisning' as type, oh.henvisning2 as value
        FROM ordre_henvisning oh
        JOIN ordre o ON o.ordrenr = oh.ordrenr
        WHERE LOWER(oh.henvisning2) LIKE $1 AND oh.henvisning2 IS NOT NULL AND ($2::text IS NULL OR o.kundenr = $2)
      ) AS suggestions
      WHERE suggestion IS NOT NULL
      LIMIT 10
    `, [searchTerm, kundenrParam]);
    
    return result.rows;
  }
};
