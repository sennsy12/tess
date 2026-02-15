import { copyFromLineStream, getTableColumns } from '../../db/index.js';
import { etlLogger } from '../../lib/logger.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { recordEtlRun } from '../etlMetrics.js';
import {
  broadcastProgress,
  cancelJob,
  completeJob,
  failJob,
  registerJob,
  updateJobProgress,
} from '../jobRegistry.js';
import { deleteCheckpoint, loadCheckpoint, saveCheckpoint } from '../checkpoint.js';
import { createDeadLetterCollector } from '../deadLetter.js';
import { recordEtlFailure } from '../etlFailures.js';
import { apiRowSource } from './sources/apiSource.js';
import { csvRowSource } from './sources/csvSource.js';
import { jsonRowSource } from './sources/jsonSource.js';
import { readableFromAsyncIterator } from './backpressure.js';
import {
  buildColumnPlan,
  formatCopyLine,
  getRowValidationError,
  normalizeHeader,
  normalizeRecord,
  transformValue,
} from './transforms.js';
import {
  ColumnPlanItem,
  EtlSourceType,
  EtlTableName,
  StreamingEtlRequest,
  StreamingEtlResult,
} from './types.js';

const CHECKPOINT_SAVE_INTERVAL = 50_000;

type SourceStream = AsyncGenerator<Record<string, unknown>>;

export interface SourceStreamOptions {
  /** Resume state from a loaded checkpoint (skipRows for file sources, nextUrl for API). */
  resumeState?: Record<string, unknown>;
  /** Ref updated by API source with nextUrl so we can save it in checkpoint. */
  resumeStateRef?: { current: Record<string, unknown> };
  /** When aborted, sources and pipeline stop. */
  signal?: AbortSignal;
}

function getSourceStream(config: StreamingEtlRequest, options: SourceStreamOptions = {}): SourceStream {
  const { resumeState, resumeStateRef, signal } = options;
  const skipRows = typeof resumeState?.skipRows === 'number' ? resumeState.skipRows : 0;

  if (config.sourceType === 'csv') {
    if (!config.csv?.filePath) {
      throw new ValidationError('csv.filePath is required for csv source');
    }
    return csvRowSource(
      config.csv.filePath,
      config.csv.delimiter,
      config.csv.compression ?? 'none',
      { skipRows, signal }
    );
  }

  if (config.sourceType === 'json') {
    if (!config.json?.filePath) {
      throw new ValidationError('json.filePath is required for json source');
    }
    return jsonRowSource(
      config.json.filePath,
      config.json.mode ?? 'array',
      config.json.compression ?? 'none',
      { skipRows, signal }
    );
  }

  if (config.sourceType === 'api') {
    if (!config.api?.url) {
      throw new ValidationError('api.url is required for api source');
    }
    const initialUrl = typeof resumeState?.nextUrl === 'string' ? resumeState.nextUrl : undefined;
    const onResumeState = resumeStateRef
      ? (state: Record<string, unknown>) => {
          resumeStateRef.current = { ...resumeStateRef.current, ...state };
        }
      : undefined;
    return apiRowSource(config.api, { initialUrl, onResumeState, signal });
  }

  throw new ValidationError(`Unsupported source type: ${String(config.sourceType)}`);
}

function mapRow(
  row: Record<string, unknown>,
  rowIndex: number,
  table: EtlTableName,
  strictMode: boolean,
  columnPlan: ColumnPlanItem[]
): { values: Array<string | number | null> | null; error: string | null } {
  const normalized = normalizeRecord(row);
  const values = columnPlan.map(({ sourceKey, dbColumn }) => {
    const raw = normalized[normalizeHeader(sourceKey)] ?? '';
    return transformValue(dbColumn, raw, rowIndex);
  });

  const valueByColumn = new Map<string, string | number | null>();
  columnPlan.forEach((item, idx) => valueByColumn.set(item.dbColumn, values[idx]));
  const error = getRowValidationError(table, valueByColumn);
  if (error) {
    if (strictMode) {
      throw new ValidationError(`Invalid row at index ${rowIndex} for table ${table}: ${error}`);
    }
    return { values: null, error };
  }
  return { values, error: null };
}

async function withRetries<T>(
  operation: () => Promise<T>,
  label: string,
  maxRetries: number = 3
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: unknown) {
      attempt += 1;
      if (attempt > maxRetries) throw error;
      const err = error as Error;
      const delayMs = 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 120);
      etlLogger.warn({ label, attempt, delayMs, error: err?.message }, 'Retrying ETL operation');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function runStreamingEtl(config: StreamingEtlRequest): Promise<StreamingEtlResult> {
  if (config.onConflict === 'upsert' && (!config.upsertKeyColumns?.length)) {
    throw new ValidationError('onConflict "upsert" requires upsertKeyColumns');
  }
  const start = Date.now();
  const jobId = config.jobId;
  const progressInterval = config.progressInterval ?? 5000;
  const deadLetterEnabled = config.deadLetter ?? false;
  const checkpointEnabled = config.checkpoint ?? false;

  if (jobId) {
    registerJob(jobId, config.table, config.sourceType);
  }

  const deadLetter = deadLetterEnabled && jobId ? createDeadLetterCollector(jobId, config.table) : null;

  const checkpoint = checkpointEnabled && jobId ? await loadCheckpoint(jobId) : null;
  const checkpointResumed = checkpoint != null;
  const resumeStateRef = config.sourceType === 'api' ? { current: { ...checkpoint?.resumeState } } : undefined;
  const sourceOptions: SourceStreamOptions = {
    resumeState: checkpoint?.resumeState,
    resumeStateRef,
    signal: config.signal,
  };

  const validColumns = await getTableColumns(config.table);
  const source = getSourceStream(config, sourceOptions);
  const iterator = source[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    const emptyResult: StreamingEtlResult = {
      table: config.table,
      durationMs: Date.now() - start,
      attemptedRows: checkpoint?.lastProcessedIndex ?? 0,
      insertedRows: 0,
      rejectedRows: 0,
      rowsPerSecond: 0,
      sourceType: config.sourceType,
      columns: [],
      jobId,
      checkpointResumed: checkpointResumed || undefined,
    };
    if (jobId) completeJob(jobId);
    recordEtlRun(emptyResult);
    return emptyResult;
  }

  const firstRow = first.value;
  const columnPlan =
    checkpointResumed && checkpoint?.columnPlan && checkpoint.columnPlan.length > 0
      ? checkpoint.columnPlan
      : buildColumnPlan(Object.keys(normalizeRecord(firstRow)), validColumns, config.sourceMapping);
  if (columnPlan.length === 0) {
    throw new ValidationError(`No matching columns found for table ${config.table}`);
  }

  let attemptedRows = checkpoint?.lastProcessedIndex ?? 0;
  let rejectedRows = 0;
  const strictMode = config.strictMode ?? false;
  const onConflict = config.onConflict ?? 'nothing';

  async function* lineGenerator(): AsyncGenerator<string> {
    const startRowIndex = attemptedRows;
    const firstResult = mapRow(firstRow, startRowIndex, config.table, strictMode, columnPlan);
    attemptedRows += 1;
    if (firstResult.values) {
      yield formatCopyLine(firstResult.values);
    } else {
      rejectedRows += 1;
      if (deadLetter && firstResult.error) {
        deadLetter.add(startRowIndex, firstRow, firstResult.error);
      }
    }

    let rowIndex = startRowIndex + 1;
    while (true) {
      if (config.signal?.aborted) {
        throw new DOMException('ETL aborted', 'AbortError');
      }
      const next = await iterator.next();
      if (next.done) break;
      const result = mapRow(next.value, rowIndex, config.table, strictMode, columnPlan);
      attemptedRows += 1;
      rowIndex += 1;
      if (result.values) {
        yield formatCopyLine(result.values);
      } else {
        rejectedRows += 1;
        if (deadLetter && result.error) {
          deadLetter.add(rowIndex - 1, next.value, result.error);
        }
      }

      if (jobId && attemptedRows % progressInterval === 0) {
        updateJobProgress(jobId, {
          attemptedRows,
          insertedRows: 0,
          rejectedRows,
          deadLetterCount: deadLetter?.totalCount?.() ?? deadLetter?.count() ?? 0,
        });
        broadcastProgress(jobId);
      }

      const deadLetterCount = deadLetter?.totalCount?.() ?? deadLetter?.count() ?? 0;
      if (config.maxRows != null && attemptedRows >= config.maxRows) {
        throw new Error('cancelled_limit_rows');
      }
      if (config.maxDurationMs != null && Date.now() - start >= config.maxDurationMs) {
        throw new Error('cancelled_limit_duration');
      }
      if (config.maxDeadLetters != null && deadLetterCount >= config.maxDeadLetters) {
        throw new Error('cancelled_limit_deadletter');
      }
      if (config.maxHeapMb != null && process.memoryUsage().heapUsed / (1024 * 1024) >= config.maxHeapMb) {
        throw new Error('cancelled_limit_heap');
      }

      if (deadLetter && (await deadLetter.flushIfOverCapacity())) {
        etlLogger.debug(
          { jobId, table: config.table },
          'Dead letter buffer flushed to disk (capacity limit)'
        );
      }

      if (checkpointEnabled && jobId && attemptedRows % CHECKPOINT_SAVE_INTERVAL === 0) {
        const resumeState =
          config.sourceType === 'api' && resumeStateRef
            ? resumeStateRef.current
            : { skipRows: attemptedRows };
        await saveCheckpoint({
          jobId,
          table: config.table,
          lastProcessedIndex: attemptedRows,
          lastProcessedAt: new Date().toISOString(),
          resumeState: Object.keys(resumeState).length > 0 ? resumeState : undefined,
          columnPlan,
        });
      }
    }
  }

  const lineStream = readableFromAsyncIterator(lineGenerator(), {
    highWaterMark: 1024,
    objectMode: false,
  });

  let insertedRows = 0;
  try {
    insertedRows = await withRetries(
      () =>
        copyFromLineStream(
          config.table,
          columnPlan.map((c) => c.dbColumn),
          lineStream,
          onConflict,
          {
            upsertKeyColumns: config.upsertKeyColumns,
            upsertUpdateColumns: config.upsertUpdateColumns,
            onProgress: (rowsStreamed) => {
              if (jobId) {
                updateJobProgress(jobId, {
                  attemptedRows,
                  insertedRows: rowsStreamed,
                  rejectedRows,
                  deadLetterCount: deadLetter?.totalCount?.() ?? deadLetter?.count() ?? 0,
                });
                broadcastProgress(jobId);
              }
            },
            progressInterval: progressInterval,
          }
        ),
      `copy-${config.table}`
    );
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    const message = err instanceof Error ? err.message : String(err);
    const isLimitCancel = typeof message === 'string' && message.startsWith('cancelled_limit_');
    if (jobId) {
      if (isAbort) {
        cancelJob(jobId);
      } else if (isLimitCancel) {
        cancelJob(jobId, message);
      } else {
        failJob(jobId, message);
        const errObj = err as Error & { code?: string };
        recordEtlFailure({
          jobId,
          stage: 'copy',
          table: config.table,
          approxRow: attemptedRows,
          errorCode: errObj?.code ?? 'UNKNOWN',
          errorMessage: message,
        }).catch((e) => etlLogger.warn({ err: e, jobId }, 'Failed to record ETL failure row'));
      }
    }
    if (deadLetter && (deadLetter.count() > 0 || deadLetter.totalCount?.() > 0)) {
      try {
        const flushed = await deadLetter.flush();
        etlLogger.warn(
          { jobId, table: config.table, deadLetterPath: flushed.path, count: flushed.count },
          isAbort
            ? 'Dead letter flushed after pipeline cancellation; rejected rows saved'
            : 'Dead letter flushed after pipeline failure; rejected rows saved'
        );
      } catch (flushErr) {
        etlLogger.error(
          { err: flushErr, jobId },
          'Failed to flush dead letter after pipeline failure'
        );
      }
    }
    throw err;
  }

  let deadLetterPath: string | undefined;
  let deadLetterCount = 0;
  if (deadLetter && (deadLetter.count() > 0 || deadLetter.totalCount?.() > 0)) {
    const flushed = await deadLetter.flush();
    deadLetterPath = flushed.path;
    deadLetterCount = flushed.count;
  }

  const durationMs = Date.now() - start;
  const rowsPerSecond =
    durationMs > 0 ? Number(((insertedRows * 1000) / durationMs).toFixed(2)) : 0;
  const result: StreamingEtlResult = {
    table: config.table,
    durationMs,
    attemptedRows,
    insertedRows,
    rejectedRows,
    rowsPerSecond,
    sourceType: config.sourceType as EtlSourceType,
    columns: columnPlan.map((c) => c.dbColumn),
    jobId,
    checkpointResumed: checkpointResumed || undefined,
    deadLetterPath: deadLetterPath ?? undefined,
    deadLetterCount: deadLetterCount || undefined,
  };

  if (jobId) {
    updateJobProgress(jobId, {
      attemptedRows,
      insertedRows,
      rejectedRows,
      deadLetterCount,
    });
    completeJob(jobId);
    broadcastProgress(jobId);
    if (checkpointEnabled) {
      await deleteCheckpoint(jobId);
    }
  }

  etlLogger.info(
    {
      stage: 'streaming-etl-complete',
      table: result.table,
      sourceType: result.sourceType,
      jobId: result.jobId,
      attemptedRows: result.attemptedRows,
      insertedRows: result.insertedRows,
      rejectedRows: result.rejectedRows,
      deadLetterCount: result.deadLetterCount,
      durationMs: result.durationMs,
      rowsPerSecond: result.rowsPerSecond,
    },
    'Streaming ETL run completed'
  );
  recordEtlRun(result);
  return result;
}
