import { query } from '../db/index.js';
import type { EtlJobProgress, EtlJobStatus, EtlSourceType } from './streaming/types.js';
import { etlLogger } from '../lib/logger.js';

type JobRow = {
  job_id: string;
  status: EtlJobStatus;
  table_name: string;
  source_type: EtlSourceType;
  attempted_rows: string;
  inserted_rows: string;
  rejected_rows: string;
  dead_letter_count: string;
  estimated_total: string | null;
  error: string | null;
  started_at: Date;
  updated_at: Date;
};

function rowToProgress(row: JobRow): EtlJobProgress {
  return {
    jobId: row.job_id,
    status: row.status,
    table: row.table_name,
    sourceType: row.source_type,
    attemptedRows: Number(row.attempted_rows),
    insertedRows: Number(row.inserted_rows),
    rejectedRows: Number(row.rejected_rows),
    deadLetterCount: Number(row.dead_letter_count),
    estimatedTotal: row.estimated_total != null ? Number(row.estimated_total) : undefined,
    error: row.error ?? undefined,
    startedAt: row.started_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Persist job snapshot; failures are logged but do not block ETL. */
export async function persistEtlJob(job: EtlJobProgress): Promise<void> {
  try {
    await query(
      `INSERT INTO etl_job_progress (
         job_id, status, table_name, source_type,
         attempted_rows, inserted_rows, rejected_rows, dead_letter_count,
         estimated_total, error, started_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::timestamptz, $12::timestamptz)
       ON CONFLICT (job_id) DO UPDATE SET
         status = EXCLUDED.status,
         attempted_rows = EXCLUDED.attempted_rows,
         inserted_rows = EXCLUDED.inserted_rows,
         rejected_rows = EXCLUDED.rejected_rows,
         dead_letter_count = EXCLUDED.dead_letter_count,
         estimated_total = EXCLUDED.estimated_total,
         error = EXCLUDED.error,
         updated_at = EXCLUDED.updated_at`,
      [
        job.jobId,
        job.status,
        job.table,
        job.sourceType,
        job.attemptedRows,
        job.insertedRows,
        job.rejectedRows,
        job.deadLetterCount,
        job.estimatedTotal ?? null,
        job.error ?? null,
        job.startedAt,
        job.updatedAt,
      ],
    );
  } catch (err) {
    etlLogger.warn({ err, jobId: job.jobId }, 'Failed to persist ETL job progress');
  }
}

export async function loadEtlJob(jobId: string): Promise<EtlJobProgress | null> {
  try {
    const result = await query(
      `SELECT * FROM etl_job_progress WHERE job_id = $1`,
      [jobId],
    );
    if (result.rows.length === 0) return null;
    return rowToProgress(result.rows[0] as JobRow);
  } catch (err) {
    etlLogger.warn({ err, jobId }, 'Failed to load ETL job progress');
    return null;
  }
}

export async function listPersistedEtlJobs(limit: number): Promise<EtlJobProgress[]> {
  try {
    const result = await query(
      `SELECT * FROM etl_job_progress ORDER BY updated_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => rowToProgress(row as JobRow));
  } catch (err) {
    etlLogger.warn({ err }, 'Failed to list persisted ETL jobs');
    return [];
  }
}
