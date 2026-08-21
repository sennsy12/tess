import { copyFromLineStream, getTableColumns } from '../../../db/index.js';
import { etlLogger } from '../../../lib/logger.js';
import { ValidationError } from '../../../middleware/errorHandler.js';
import { recordEtlRun } from '../../etlMetrics.js';
import { scheduleStatisticsRefreshAfterEtl } from '../../../services/statsAggregateService.js';
import {
  broadcastProgress,
  cancelJob,
  completeJob,
  failJob,
  registerJob,
  updateJobProgress,
} from '../../jobRegistry.js';
import { deleteCheckpoint, loadCheckpoint, saveCheckpoint } from '../../checkpoint.js';
import { createDeadLetterCollector } from '../../deadLetter.js';
import { recordEtlFailure } from '../../etlFailures.js';
import { readableFromAsyncIterator } from '../backpressure.js';
import { buildColumnPlan, formatCopyLine, normalizeRecord } from '../transforms.js';
import {
  EtlSourceType,
  StreamingEtlRequest,
  StreamingEtlResult,
} from '../types.js';
import { getSourceStream, SourceStreamOptions } from './sourceStream.js';
import { CHECKPOINT_SAVE_INTERVAL, mapRow, withRetries } from './helpers.js';

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
    // Expensive housekeeping (heap sampling, dead-letter counting, limit
    // checks, dead-letter flush) runs every N rows instead of every row.
    const LIMIT_CHECK_INTERVAL = 1000;
    let rowsSinceLimitCheck = 0;
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

      rowsSinceLimitCheck += 1;
      const maxRowsReached =
        config.maxRows != null && attemptedRows >= config.maxRows;
      if (
        rowsSinceLimitCheck >= LIMIT_CHECK_INTERVAL ||
        maxRowsReached ||
        (config.maxDeadLetters != null && rejectedRows > 0)
      ) {
        rowsSinceLimitCheck = 0;

        const deadLetterCount = deadLetter?.totalCount?.() ?? deadLetter?.count() ?? 0;
        if (maxRowsReached) {
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

  let insertedRows: number;
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
  scheduleStatisticsRefreshAfterEtl(config.table);
  return result;
}
