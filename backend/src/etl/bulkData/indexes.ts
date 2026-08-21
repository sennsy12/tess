import { query } from '../../db/index.js';
import { ensureTrigramSearchIndexes } from '../../lib/trigramIndexes.js';

/** Indexes dropped during bulk load to maximize COPY throughput. */
const BULK_LOAD_INDEXES = [
  'idx_ordre_kundenr',
  'idx_ordre_dato',
  'idx_ordre_firmaid',
  'idx_ordre_lagernavn',
  'idx_ordre_kundenr_dato',
  'idx_ordre_dato_kundenr',
  'idx_ordre_dato_sum',
  'idx_ordre_active',
  'idx_ordrelinje_ordrenr',
  'idx_ordrelinje_varekode',
  'idx_ordrelinje_linjestatus',
  'idx_ordrelinje_varekode_ordrenr',
  'idx_ordrelinje_stats',
] as const;

const BULK_INDEX_DDL: Record<(typeof BULK_LOAD_INDEXES)[number], string> = {
  idx_ordre_kundenr: 'CREATE INDEX IF NOT EXISTS idx_ordre_kundenr ON ordre(kundenr)',
  idx_ordre_dato: 'CREATE INDEX IF NOT EXISTS idx_ordre_dato ON ordre(dato DESC)',
  idx_ordre_firmaid: 'CREATE INDEX IF NOT EXISTS idx_ordre_firmaid ON ordre(firmaid)',
  idx_ordre_lagernavn: 'CREATE INDEX IF NOT EXISTS idx_ordre_lagernavn ON ordre(lagernavn)',
  idx_ordre_kundenr_dato: 'CREATE INDEX IF NOT EXISTS idx_ordre_kundenr_dato ON ordre(kundenr, dato DESC)',
  idx_ordre_dato_kundenr: 'CREATE INDEX IF NOT EXISTS idx_ordre_dato_kundenr ON ordre (dato, kundenr)',
  idx_ordre_dato_sum: 'CREATE INDEX IF NOT EXISTS idx_ordre_dato_sum ON ordre (dato DESC) INCLUDE (sum, kundenr)',
  idx_ordre_active: 'CREATE INDEX IF NOT EXISTS idx_ordre_active ON ordre(ordrenr) WHERE sum > 0',
  idx_ordrelinje_ordrenr: 'CREATE INDEX IF NOT EXISTS idx_ordrelinje_ordrenr ON ordrelinje(ordrenr)',
  idx_ordrelinje_varekode: 'CREATE INDEX IF NOT EXISTS idx_ordrelinje_varekode ON ordrelinje(varekode)',
  idx_ordrelinje_linjestatus: 'CREATE INDEX IF NOT EXISTS idx_ordrelinje_linjestatus ON ordrelinje(linjestatus)',
  idx_ordrelinje_varekode_ordrenr:
    'CREATE INDEX IF NOT EXISTS idx_ordrelinje_varekode_ordrenr ON ordrelinje (varekode, ordrenr) INCLUDE (linjesum, antall)',
  idx_ordrelinje_stats:
    'CREATE INDEX IF NOT EXISTS idx_ordrelinje_stats ON ordrelinje(ordrenr, varekode, linjesum)',
};

/** Drop bulk-loading indexes (idempotent). */
export async function dropBulkIndexes(): Promise<void> {
  await Promise.all(BULK_LOAD_INDEXES.map((name) => query(`DROP INDEX IF EXISTS ${name}`)));
}

/** Recreate bulk-loading indexes (idempotent). Trigram indexes come from migrations / ensureTrigramSearchIndexes. */
export async function createBulkIndexes(): Promise<void> {
  await Promise.all(BULK_LOAD_INDEXES.map((name) => query(BULK_INDEX_DDL[name])));
  await ensureTrigramSearchIndexes();
}
