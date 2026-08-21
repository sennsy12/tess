import { etlLogger } from '../../lib/logger.js';
import { runBulkLoadFast } from '../bulkLoadFast.js';

export interface GenerateBulkTestResult {
  customersGenerated: number;
  usersGenerated: number;
  productsGenerated: number;
  ordersGenerated: number;
  orderLinesGenerated: number;
  orderReferencesGenerated: number;
  /** Total fact-table rows actually inserted (ordre + ordrelinje + henvisning). */
  totalRows: number;
  generationTimeMs: number;
}

/**
 * Generate bulk test data directly into the database via the fast bulk engine:
 * unlogged staging tables, pooled COPY buffers, index-free load, then a single
 * indexed merge with concurrent index rebuild. O(1) heap, 100k+ rows/sec.
 */
export async function generateBulkTestData(config: {
  customers?: number;
  orders?: number;
  linesPerOrder?: number;
}): Promise<GenerateBulkTestResult> {
  const { customers = 1000, orders = 100000, linesPerOrder = 5 } = config;

  etlLogger.info(
    { stage: 'bulk-generate-start', customers, orders, estimatedLines: orders * linesPerOrder },
    'Generating and streaming bulk data'
  );
  const startTime = Date.now();

  const result = await runBulkLoadFast({
    totalOrders: orders,
    customers,
    linesPerOrder,
  });

  const duration = Date.now() - startTime;
  etlLogger.info(
    { stage: 'bulk-generate-complete', durationMs: duration, totalRows: result.totalRows },
    'Bulk data generated and streamed'
  );

  return {
    customersGenerated: customers,
    usersGenerated: customers,
    productsGenerated: 500,
    ordersGenerated: result.ordrer,
    orderLinesGenerated: result.ordrelinjer,
    orderReferencesGenerated: result.ordre_henvisninger,
    totalRows: result.totalRows,
    generationTimeMs: duration,
  };
}
