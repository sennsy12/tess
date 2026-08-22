import type { PoolClient } from 'pg';
import { query } from '../../db/index.js';
import { etlLogger } from '../../lib/logger.js';

/**
 * Idempotent integrity guard for the fact tables.
 *
 * The fast bulk path drops FKs and search indexes around the merge for
 * throughput. If the process dies in the window between merge-commit and
 * restore, the database would silently run without those constraints.
 * This module detects that state and repairs it.
 *
 * Call sites:
 *  - server boot (heals a crash that happened mid-bulk-load)
 *  - start of every bulk load (defense in depth)
 */

/** FK constraints on the fact tables: [table, constraint, add-DDL]. */
export const FACT_TABLE_FKS: Array<[string, string, string]> = [
  ['ordre', 'ordre_kundenr_fkey', 'FOREIGN KEY (kundenr) REFERENCES public.kunde(kundenr)'],
  ['ordre', 'ordre_firmaid_fkey', 'FOREIGN KEY (firmaid) REFERENCES public.firma(firmaid)'],
  ['ordre', 'ordre_lagernavn_firmaid_fkey', 'FOREIGN KEY (lagernavn, firmaid) REFERENCES public.lager(lagernavn, firmaid)'],
  ['ordre', 'ordre_valutaid_fkey', 'FOREIGN KEY (valutaid) REFERENCES public.valuta(valutaid)'],
  ['ordrelinje', 'ordrelinje_ordrenr_fkey', 'FOREIGN KEY (ordrenr) REFERENCES public.ordre(ordrenr)'],
  ['ordrelinje', 'ordrelinje_varekode_fkey', 'FOREIGN KEY (varekode) REFERENCES public.vare(varekode)'],
  ['ordre_henvisning', 'ordre_henvisning_ordrenr_linjenr_fkey', 'FOREIGN KEY (ordrenr, linjenr) REFERENCES public.ordrelinje(ordrenr, linjenr)'],
];

/** Plain btree search indexes on ordre_henvisning (trigram ones live in ensureTrigramSearchIndexes). */
const HENVISNING_BTREE_INDEXES: Array<[string, string]> = [
  ['idx_ordre_henvisning_h1', 'ordre_henvisning(henvisning1)'],
  ['idx_ordre_henvisning_h2', 'ordre_henvisning(henvisning2)'],
  ['idx_ordre_henvisning_h3', 'ordre_henvisning(henvisning3)'],
  ['idx_ordre_henvisning_h4', 'ordre_henvisning(henvisning4)'],
  ['idx_ordre_henvisning_h5', 'ordre_henvisning(henvisning5)'],
];

/**
 * Ensure all fact-table FK constraints and secondary indexes exist.
 * Safe to call repeatedly and concurrently with normal traffic: every
 * statement is a metadata-only no-op when nothing is missing.
 */
export async function ensureFactTableIntegrity(executor?: PoolClient): Promise<void> {
  const exec: (sql: string, params?: unknown[]) => Promise<any> = executor
    ? (sql, params) => (executor as any).query(sql, params)
    : (sql, params) => query(sql, params);

  const missingFks: string[] = [];
  for (const [table, fk] of FACT_TABLE_FKS) {
    const r = await exec(
      `SELECT 1 FROM pg_constraint WHERE conname = $2 AND conrelid = to_regclass($1)::oid`,
      [`public.${table}`, fk]
    );
    if (!r.rows?.length) missingFks.push(`${table}.${fk}`);
  }

  if (missingFks.length > 0) {
    etlLogger.warn({ missingFks }, 'Fact-table FK constraints missing; restoring as NOT VALID');
    for (const [table, fk, ddl] of FACT_TABLE_FKS) {
      if (missingFks.includes(`${table}.${fk}`)) {
        await exec(`ALTER TABLE ${table} ADD CONSTRAINT ${fk} ${ddl} NOT VALID`);
      }
    }
  }

  // Secondary indexes (all idempotent).
  const { createBulkIndexes } = await import('../bulkData/indexes.js');
  await createBulkIndexes();
  for (const [name, def] of HENVISNING_BTREE_INDEXES) {
    await exec(`CREATE INDEX IF NOT EXISTS ${name} ON ${def}`);
  }
}
