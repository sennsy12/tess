import { query } from '../db/index.js';

export const suggestionModel = {
  search: async (q: string, user?: { role: string; kundenr?: string }) => {
    const searchTerm = `%${q.toLowerCase()}%`;
    
    // Build kunde filter for kunde users
    const kundeFilter = user?.role === 'kunde' && user?.kundenr 
      ? `AND o.kundenr = '${user.kundenr}'` 
      : '';
    
    // Search across multiple fields
    const result = await query(`
      SELECT DISTINCT suggestion, type FROM (
        -- Customer names
        SELECT k.kundenavn as suggestion, 'kunde' as type
        FROM kunde k
        JOIN ordre o ON o.kundenr = k.kundenr
        WHERE LOWER(k.kundenavn) LIKE $1 ${kundeFilter}
        
        UNION
        
        -- Order references
        SELECT o.kundeordreref as suggestion, 'referanse' as type
        FROM ordre o
        WHERE LOWER(o.kundeordreref) LIKE $1 AND o.kundeordreref IS NOT NULL ${kundeFilter}
        
        UNION
        
        -- Customer references
        SELECT o.kunderef as suggestion, 'kunderef' as type
        FROM ordre o
        WHERE LOWER(o.kunderef) LIKE $1 AND o.kunderef IS NOT NULL ${kundeFilter}
        
        UNION
        
        -- Firma names
        SELECT f.firmanavn as suggestion, 'firma' as type
        FROM firma f
        JOIN ordre o ON o.firmaid = f.firmaid
        WHERE LOWER(f.firmanavn) LIKE $1 ${kundeFilter}
        
        UNION
        
        -- Lager names
        SELECT l.lagernavn as suggestion, 'lager' as type
        FROM lager l
        JOIN ordre o ON o.lagernavn = l.lagernavn
        WHERE LOWER(l.lagernavn) LIKE $1 ${kundeFilter}
        
        UNION
        
        -- Product names
        SELECT v.varenavn as suggestion, 'vare' as type
        FROM vare v
        JOIN ordrelinje ol ON ol.varekode = v.varekode
        JOIN ordre o ON o.ordrenr = ol.ordrenr
        WHERE LOWER(v.varenavn) LIKE $1 ${kundeFilter}
        
        UNION
        
        -- Henvisning1
        SELECT oh.henvisning1 as suggestion, 'henvisning' as type
        FROM ordre_henvisning oh
        JOIN ordre o ON o.ordrenr = oh.ordrenr
        WHERE LOWER(oh.henvisning1) LIKE $1 AND oh.henvisning1 IS NOT NULL ${kundeFilter}
        
        UNION
        
        -- Henvisning2
        SELECT oh.henvisning2 as suggestion, 'henvisning' as type
        FROM ordre_henvisning oh
        JOIN ordre o ON o.ordrenr = oh.ordrenr
        WHERE LOWER(oh.henvisning2) LIKE $1 AND oh.henvisning2 IS NOT NULL ${kundeFilter}
      ) AS suggestions
      WHERE suggestion IS NOT NULL
      LIMIT 10
    `, [searchTerm]);
    
    return result.rows;
  }
};
