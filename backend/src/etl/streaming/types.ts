export type EtlTableName = 'ordre' | 'ordrelinje' | 'kunde' | 'vare' | 'firma' | 'lager';

export type EtlSourceType = 'csv' | 'json' | 'api' | 'generator';

export type JsonInputMode = 'ndjson' | 'array';

export type OnConflictStrategy = 'nothing' | 'error' | 'upsert';

export type EtlJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type CompressionType = 'none' | 'gzip' | 'brotli';

export interface ApiSourceConfig {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
  dataPath?: string;
  nextPagePath?: string;
  maxPages?: number;
  /** Fetch up to N pages in parallel (1 = sequential). */
  parallelPages?: number;
  /** Min ms between requests (rate limit). */
  minRequestIntervalMs?: number;
}

export interface JsonSourceConfig {
  filePath: string;
  mode?: JsonInputMode;
  compression?: CompressionType;
}

export interface CsvSourceConfig {
  filePath: string;
  delimiter?: string;
  compression?: CompressionType;
}

export interface GeneratorSourceConfig {
  count: number;
  customers?: number;
  linesPerOrder?: number;
}

export interface StreamingEtlRequest {
  sourceType: EtlSourceType;
  table: EtlTableName;
  onConflict?: OnConflictStrategy;
  strictMode?: boolean;
  sourceMapping?: Record<string, string>;
  csv?: CsvSourceConfig;
  json?: JsonSourceConfig;
  api?: ApiSourceConfig;
  generator?: GeneratorSourceConfig;
  /** If set, job is tracked and progress is broadcast. */
  jobId?: string;
  /** Enable checkpoint/resume (file-based). */
  checkpoint?: boolean;
  /** Enable dead-letter export for failed rows. */
  deadLetter?: boolean;
  /** Progress callback interval (rows). */
  progressInterval?: number;
  /** For upsert: unique key columns (e.g. ['ordrenr']). */
  upsertKeyColumns?: string[];
  /** For upsert: columns to update when conflict (default: all non-key). */
  upsertUpdateColumns?: string[];
  /** When aborted, the pipeline stops and the job is marked cancelled. */
  signal?: AbortSignal;
  /** Optional safety limits: abort when exceeded (status cancelled with reason). */
  maxRows?: number;
  maxDurationMs?: number;
  maxDeadLetters?: number;
  maxHeapMb?: number;
}

export interface ColumnPlanItem {
  sourceKey: string;
  dbColumn: string;
}

export interface StreamingEtlResult {
  table: EtlTableName;
  durationMs: number;
  attemptedRows: number;
  insertedRows: number;
  rejectedRows: number;
  rowsPerSecond: number;
  sourceType: EtlSourceType;
  columns: string[];
  jobId?: string;
  checkpointResumed?: boolean;
  deadLetterPath?: string;
  deadLetterCount?: number;
}

export interface EtlJobProgress {
  jobId: string;
  status: EtlJobStatus;
  table: string;
  sourceType: EtlSourceType;
  attemptedRows: number;
  insertedRows: number;
  rejectedRows: number;
  deadLetterCount: number;
  startedAt: string;
  updatedAt: string;
  error?: string;
  /** Estimated total rows (if known, e.g. from Content-Length or API). */
  estimatedTotal?: number;
}

export interface EtlCheckpoint {
  jobId: string;
  table: string;
  lastProcessedIndex: number;
  lastProcessedAt: string;
  /** Serialized state to resume source (e.g. API next URL, or skipRows for file sources). */
  resumeState?: Record<string, unknown>;
  /** Column plan when resuming so we don't need to re-read the first row. */
  columnPlan?: ColumnPlanItem[];
}

export interface DeadLetterRow {
  rowIndex: number;
  raw: Record<string, unknown>;
  error: string;
  timestamp: string;
}
