/**
 * Database Access Layer (barrel)
 *
 * The implementation lives in focused modules; this file re-exports the
 * public API so existing imports (`../db/index.js`) keep working:
 * - `./pool.ts`         – shared pool, config, `getPoolStats`
 * - `./query.ts`        – `query`, `getClient`, `transaction`
 * - `./batchInsert.ts`  – `batchInsert` (validated + quoted identifiers)
 * - `./copyLoaders.ts`  – `bulkCopy`, `copyFromLineStream`, `getTableColumns`
 * - `./identifiers.ts`  – `quoteIdentifier`, identifier safety helpers
 *
 * @module db
 */
export { default as pool, getPoolStats } from './pool.js';
export { query, getClient, transaction } from './query.js';
export { batchInsert } from './batchInsert.js';
export {
  bulkCopy,
  copyFromLineStream,
  getTableColumns,
  clearTableColumnsCache,
} from './copyLoaders.js';
export type { CopyFromLineStreamOptions } from './copyLoaders.js';
export { quoteIdentifier } from './identifiers.js';
export { default } from './pool.js';
