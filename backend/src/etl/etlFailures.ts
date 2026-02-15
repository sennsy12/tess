import { query } from '../db/index.js';

export interface EtlFailureRow {
  id: number;
  job_id: string;
  stage: string;
  table_name: string | null;
  approx_row: number | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
}

/**
 * Record a single failure summary for an ETL job (COPY or transform failure).
 */
export async function recordEtlFailure(params: {
  jobId: string;
  stage: string;
  table?: string;
  approxRow?: number;
  errorCode?: string;
  errorMessage?: string;
}): Promise<void> {
  await query(
    `INSERT INTO public.etl_failures (job_id, stage, table_name, approx_row, error_code, error_message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      params.jobId,
      params.stage,
      params.table ?? null,
      params.approxRow ?? null,
      params.errorCode ?? null,
      params.errorMessage ?? null,
    ]
  );
}

/**
 * Get the most recent failure record for a job, if any.
 */
export async function getLastFailureForJob(jobId: string): Promise<EtlFailureRow | null> {
  const result = await query(
    `SELECT id, job_id, stage, table_name, approx_row, error_code, error_message, created_at
     FROM public.etl_failures
     WHERE job_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [jobId]
  );
  const row = result.rows[0] as EtlFailureRow | undefined;
  return row ?? null;
}
