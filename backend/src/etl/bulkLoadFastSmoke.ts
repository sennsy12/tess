import { runBulkLoadFast } from './bulkLoadFast.js';
import { etlLogger } from '../lib/logger.js';

async function main() {
  try {
    const totalOrders = 100_000;
    const customers = 1_000;
    const linesPerOrder = 5;

    etlLogger.info(
      { totalOrders, customers, linesPerOrder },
      'Running bulkLoadFast smoke test'
    );

    const result = await runBulkLoadFast({ totalOrders, customers, linesPerOrder });
    // Print a concise JSON summary so it is easy to inspect from the terminal.
    // Includes rows/sec and total rows inserted.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('bulkLoadFast smoke test failed:', error);
    process.exitCode = 1;
  }
}

void main();

