import { query } from '../../db/index.js';

/**
 * Fast count of all tables
 */
export async function getTableCounts(): Promise<Record<string, number>> {
  const tables = ['kunde', 'vare', 'ordre', 'ordrelinje', 'ordre_henvisning', 'firma', 'lager', 'users'];
  const counts: Record<string, number> = {};

  for (const table of tables) {
    try {
      // Use estimate for large tables (much faster than COUNT(*))
      const result = await query(`
        SELECT reltuples::bigint AS estimate 
        FROM pg_class 
        WHERE relname = $1
      `, [table]);
      counts[table] = result.rows[0]?.estimate || 0;
    } catch {
      counts[table] = 0;
    }
  }

  return counts;
}
