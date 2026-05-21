import { query } from '../db/index.js';
import { logger } from './logger.js';

/**
 * Trigram GIN indexes for ILIKE search — canonical DDL (see migration 004).
 * Safe to call after bulk load; uses IF NOT EXISTS.
 */
const TRIGRAM_INDEX_DDL = [
  'CREATE EXTENSION IF NOT EXISTS pg_trgm',
  `CREATE INDEX IF NOT EXISTS idx_kunde_kundenavn_trgm
     ON public.kunde USING gin (kundenavn gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_kunde_kundenr_trgm
     ON public.kunde USING gin (kundenr gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_kundeordreref_trgm
     ON public.ordre USING gin (kundeordreref gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_kunderef_trgm
     ON public.ordre USING gin (kunderef gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_kundenr_trgm
     ON public.ordre USING gin (kundenr gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_vare_varekode_trgm
     ON public.vare USING gin (varekode gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_vare_varenavn_trgm
     ON public.vare USING gin (varenavn gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h1_trgm
     ON public.ordre_henvisning USING gin (henvisning1 gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h2_trgm
     ON public.ordre_henvisning USING gin (henvisning2 gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h3_trgm
     ON public.ordre_henvisning USING gin (henvisning3 gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h4_trgm
     ON public.ordre_henvisning USING gin (henvisning4 gin_trgm_ops)`,
  `CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h5_trgm
     ON public.ordre_henvisning USING gin (henvisning5 gin_trgm_ops)`,
] as const;

export async function ensureTrigramSearchIndexes(): Promise<void> {
  for (const ddl of TRIGRAM_INDEX_DDL) {
    await query(ddl);
  }
  logger.info('Trigram search indexes ensured');
}
