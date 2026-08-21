// Facade module: implementation lives in ./bulkData/* — public API unchanged.

export type {
  KundeRow,
  BrukerRow,
  VareRow,
  OrdreRow,
  OrdrelinjeRow,
  HenvisningRow,
} from './bulkData/rows.js';

export { getDimensionData, ensureDimensionData } from './bulkData/dimensions.js';
export { generateBulkTestData } from './bulkData/generate.js';
export { dropBulkIndexes, createBulkIndexes } from './bulkData/indexes.js';
export { runBulkPipelineStreaming } from './bulkData/streaming.js';
export { getTableCounts } from './bulkData/counts.js';
