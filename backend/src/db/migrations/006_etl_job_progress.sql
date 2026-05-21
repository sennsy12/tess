-- Durable ETL job progress (survives API restarts; complements pg-boss queue)
CREATE TABLE IF NOT EXISTS etl_job_progress (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
  table_name TEXT NOT NULL,
  source_type TEXT NOT NULL,
  attempted_rows BIGINT NOT NULL DEFAULT 0,
  inserted_rows BIGINT NOT NULL DEFAULT 0,
  rejected_rows BIGINT NOT NULL DEFAULT 0,
  dead_letter_count BIGINT NOT NULL DEFAULT 0,
  estimated_total BIGINT,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etl_job_progress_updated_at
  ON etl_job_progress (updated_at DESC);
