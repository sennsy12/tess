import { query } from '../db/index.js';
import { logger } from '../lib/logger.js';
import type { EtlTableName } from '../etl/streaming/types.js';

const STATS_AFFECTING_TABLES = new Set<EtlTableName>(['ordre', 'ordrelinje', 'kunde', 'vare']);

let refreshInFlight: Promise<void> | null = null;
let refreshQueued = false;

/**
 * Refresh pre-aggregated statistics materialized views and update table statistics.
 * Called by the aggregate-stats scheduler job.
 */
export async function refreshStatisticsAggregates(): Promise<void> {
  const views = ['mv_stats_by_kunde', 'mv_stats_by_varegruppe'];

  for (const view of views) {
    try {
      await query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view}`);
      logger.info({ view }, 'Refreshed statistics materialized view');
    } catch (err) {
      logger.warn({ err, view }, 'Concurrent refresh failed, trying non-concurrent');
      await query(`REFRESH MATERIALIZED VIEW ${view}`);
    }
  }

  await query('ANALYZE ordre');
  await query('ANALYZE ordrelinje');
  await query('ANALYZE kunde');
  logger.info('Statistics aggregate refresh complete');
}

async function runCoalescedRefresh(): Promise<void> {
  refreshInFlight = refreshStatisticsAggregates();
  try {
    await refreshInFlight;
  } finally {
    refreshInFlight = null;
    if (refreshQueued) {
      refreshQueued = false;
      void runCoalescedRefresh();
    }
  }
}

/**
 * Coalesced MV refresh after ETL mutates stats-related tables (non-blocking).
 */
export function scheduleStatisticsRefreshAfterEtl(table: string): void {
  if (!STATS_AFFECTING_TABLES.has(table as EtlTableName)) return;

  if (refreshInFlight) {
    refreshQueued = true;
    return;
  }

  void runCoalescedRefresh().catch((err) => {
    logger.error({ err, table }, 'Post-ETL statistics refresh failed');
  });
}
