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
export async function executeIngestJob(payload: EtlIngestJobPayload) {
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
    json: jsonOpts,
    api,
  } = body;

  const abortController = new AbortController();
  setJobAbortController(jobId, abortController);
  registerJob(jobId, table, sourceType as EtlSourceType);

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
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    if (!isAbort) {
      failJob(jobId, message);
    }
    throw err;
  } finally {
    clearJobAbortController(jobId);
    if (uploadedFilePath) {
      await unlinkIfExists(uploadedFilePath);
    }
  }
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

  await boss.work(ETL_INGEST_QUEUE, { teamConcurrency }, async (job) => {
    const payload = job.data as EtlIngestJobPayload;
    etlLogger.info({ jobId: payload.jobId, table: payload.body.table }, 'Processing queued ETL job');
    await executeIngestJob(payload);
  });

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
