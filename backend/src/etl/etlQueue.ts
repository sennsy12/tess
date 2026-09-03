import { randomUUID } from 'crypto';
import PgBoss from 'pg-boss';
import { runStreamingEtl } from './streaming/pipeline.js';
import type { EtlIngestBody } from '../middleware/validation.js';
import {
  registerJob,
  completeJob,
  failJob,
  setJobAbortController,
  clearJobAbortController,
} from './jobRegistry.js';
import { etlLogger } from '../lib/logger.js';
import { unlinkIfExists } from '../lib/fsUtil.js';
import type { EtlSourceType, EtlTableName } from './streaming/types.js';

export const ETL_INGEST_QUEUE = 'etl-ingest';

/** Default upsert keys per table for incremental ETL. */
export const DEFAULT_UPSERT_KEYS: Record<EtlTableName, string[]> = {
  ordre: ['ordrenr'],
  ordrelinje: ['ordrenr', 'linjenr'],
  kunde: ['kundenr'],
  vare: ['varekode'],
  firma: ['firmaid'],
  lager: ['lagernavn', 'firmaid'],
};

export interface EtlIngestJobPayload {
  jobId: string;
  body: EtlIngestBody;
  uploadedFilePath?: string;
}

let boss: PgBoss | null = null;

function resolveUpsertKeys(table: EtlTableName, body: EtlIngestBody): string[] | undefined {
  if (body.onConflict !== 'upsert') return body.upsertKeyColumns;
  return body.upsertKeyColumns ?? DEFAULT_UPSERT_KEYS[table];
}

/** Execute a streaming ETL ingest job (shared by sync and async paths). */
export async function executeIngestJob(
  payload: EtlIngestJobPayload,
  retryInfo?: { retryCount: number; retryLimit: number }
) {
  const { jobId, body, uploadedFilePath } = payload;
  const {
    sourceType,
    table,
    strictMode,
    onConflict,
    sourceMapping,
    checkpoint,
    deadLetter,
    progressInterval,
    upsertUpdateColumns,
    maxRows,
    maxDurationMs,
    maxDeadLetters,
    maxHeapMb,
    csv: csvOpts,
    xlsx: xlsxOpts,
    json: jsonOpts,
    api,
  } = body;

  const abortController = new AbortController();
  setJobAbortController(jobId, abortController);
  registerJob(jobId, table, sourceType as EtlSourceType);

  // Upload retention: with pg-boss retries enabled, deleting the upload in a
  // blind finally would guarantee "file not found" on every retry attempt.
  // Keep the file when this attempt failed AND another retry remains.
  let failedWithRetryRemaining = false;

  try {
    const result = await runStreamingEtl({
      sourceType: sourceType as EtlSourceType,
      table,
      strictMode,
      onConflict,
      sourceMapping,
      jobId,
      checkpoint,
      deadLetter,
      progressInterval,
      upsertKeyColumns: resolveUpsertKeys(table, body),
      upsertUpdateColumns,
      maxRows,
      maxDurationMs,
      maxDeadLetters,
      maxHeapMb,
      signal: abortController.signal,
      csv:
        sourceType === 'csv' && uploadedFilePath
          ? {
              filePath: uploadedFilePath,
              delimiter: csvOpts?.delimiter,
              compression: csvOpts?.compression ?? 'none',
            }
          : undefined,
      xlsx:
        sourceType === 'xlsx' && uploadedFilePath
          ? {
              filePath: uploadedFilePath,
              sheet: xlsxOpts?.sheet,
            }
          : undefined,
      json:
        sourceType === 'json' && uploadedFilePath
          ? {
              mode: jsonOpts?.mode ?? 'array',
              filePath: uploadedFilePath,
              compression: jsonOpts?.compression ?? 'none',
            }
          : undefined,
      api: sourceType === 'api' && api ? api : undefined,
    });
    completeJob(jobId);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isAbort = isIngestCancellation(err);
    if (!isAbort) {
      failJob(jobId, message);
      failedWithRetryRemaining =
        retryInfo !== undefined && retryInfo.retryCount < retryInfo.retryLimit;
    } else if (retryInfo) {
      // Cancellations are deliberate; make sure the queue never resurrects
      // them via retry (the worker also swallows these to complete cleanly).
      etlLogger.info({ jobId }, 'Queued ETL job was cancelled — no retry will be scheduled');
    }
    throw err;
  } finally {
    clearJobAbortController(jobId);
    if (uploadedFilePath && !failedWithRetryRemaining) {
      await unlinkIfExists(uploadedFilePath);
    } else if (uploadedFilePath) {
      etlLogger.warn(
        { jobId, uploadedFilePath },
        'Keeping uploaded file for pending ETL retry attempt'
      );
    }
  }
}

/**
 * True when the pipeline stopped because someone asked it to stop (abort
 * signal) or hit a user-facing limit (rows/duration/dead-letter/heap). These
 * are deliberate stops recorded as `cancelled` in the job registry and must
 * never be retried by the queue.
 */
export function isIngestCancellation(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  const message = err instanceof Error ? err.message : String(err);
  return typeof message === 'string' && message.startsWith('cancelled_limit_');
}

export async function initEtlQueue(): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tess';

  boss = new PgBoss({
    connectionString,
    schema: 'pgboss',
    monitorStateIntervalSeconds: 30,
  });

  boss.on('error', (err) => {
    etlLogger.error({ err }, 'pg-boss error');
  });

  await boss.start();

  // Concurrency 1 keeps memory flat for huge jobs; raise via ETL_TEAM_CONCURRENCY
  // when jobs target different tables and throughput matters more than heap headroom.
  const teamConcurrencyRaw = Number(process.env.ETL_TEAM_CONCURRENCY ?? '1');
  const teamConcurrency = Number.isFinite(teamConcurrencyRaw) && teamConcurrencyRaw >= 1
    ? Math.floor(teamConcurrencyRaw)
    : 1;

  await boss.work<EtlIngestJobPayload>(
    ETL_INGEST_QUEUE,
    { teamConcurrency, includeMetadata: true },
    async (job) => {
      const payload = job.data;
      etlLogger.info(
        { jobId: payload.jobId, table: payload.body.table, attempt: job.retrycount + 1 },
        'Processing queued ETL job'
      );
      try {
        await executeIngestJob(payload, {
          retryCount: job.retrycount,
          retryLimit: job.retrylimit,
        });
      } catch (err) {
        // Deliberate cancellations must complete the job normally — throwing
        // would make pg-boss treat them as failures and re-run cancelled work.
        if (isIngestCancellation(err)) {
          etlLogger.info({ jobId: payload.jobId }, 'ETL job cancellation recorded; not retrying');
          return;
        }
        throw err;
      }
    }
  );

  etlLogger.info('ETL job queue initialized');
}

export async function enqueueIngestJob(payload: EtlIngestJobPayload): Promise<string> {
  if (!boss) {
    throw new Error('ETL queue not initialized');
  }
  const queueJobId = await boss.send(ETL_INGEST_QUEUE, payload, {
    singletonKey: payload.jobId,
    retryLimit: 2,
    retryDelay: 60,
    expireInHours: 24,
  });
  if (!queueJobId) {
    throw new Error('Failed to enqueue ETL job');
  }
  registerJob(payload.jobId, payload.body.table, payload.body.sourceType as EtlSourceType, 'pending');
  return queueJobId;
}

export function createIngestJobId(provided?: string): string {
  return provided ?? randomUUID();
}

export async function stopEtlQueue(): Promise<void> {
  if (boss) {
    await boss.stop({ graceful: true, timeout: 30000 });
    boss = null;
    etlLogger.info('ETL job queue stopped');
  }
}

export function isEtlQueueReady(): boolean {
  return boss !== null;
}
