import { z } from 'zod';

// ============================================================
// ETL validation schemas
// ============================================================

export const bulkDataSchema = z.object({
  customers: z.number().int().min(1).max(100000).default(1000),
  orders: z.number().int().min(1).max(10000000).default(100000),
  linesPerOrder: z.number().int().min(1).max(100).default(5),
  actionKey: z.string().min(1).max(200).optional(),
});

/** Staged bulk pipeline: generate + insert in batches to avoid OOM (20M+ rows). */
export const bulkStagesSchema = z.object({
  totalOrders: z.number().int().min(1).max(20_000_000),
  ordersPerBatch: z.number().int().min(10_000).max(500_000).default(50_000),
  customers: z.number().int().min(1).max(100000).default(1000),
  linesPerOrder: z.number().int().min(1).max(100).default(5),
});

/** Streaming bulk pipeline and fast bulk loader. */
export const bulkStreamingSchema = z.object({
  totalOrders: z.number().int().min(1).max(20_000_000),
  customers: z.number().int().min(1).max(100000).default(1000),
  linesPerOrder: z.number().int().min(1).max(100).default(5),
  jobId: z.string().max(100).optional(),
});

export const etlIngestSchema = z.object({
  sourceType: z.enum(['csv', 'json', 'api']),
  table: z.enum(['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager']),
  strictMode: z.boolean().default(false),
  onConflict: z.enum(['nothing', 'error', 'upsert']).default('upsert'),
  sourceMapping: z.record(z.string(), z.string()).optional(),
  jobId: z.string().max(100).optional(),
  checkpoint: z.boolean().default(true),
  deadLetter: z.boolean().default(false),
  /** When true (default), ingest returns 202 and runs via pg-boss queue. Set false for synchronous ingest. */
  async: z.boolean().default(true),
  progressInterval: z.number().int().min(100).max(100000).default(5000),
  // Column identifiers end up interpolated into SQL (identifiers cannot be
  // bound as parameters). The pipeline additionally validates them against
  // the live table schema; this regex is a first-pass filter.
  upsertKeyColumns: z
    .array(z.string().max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Invalid column name'))
    .optional(),
  upsertUpdateColumns: z
    .array(z.string().max(100).regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Invalid column name'))
    .optional(),
  maxRows: z.number().int().min(1).optional(),
  maxDurationMs: z.number().int().min(1000).optional(),
  maxDeadLetters: z.number().int().min(1).optional(),
  maxHeapMb: z.number().int().min(1).optional(),
  csv: z
    .object({
      delimiter: z.string().min(1).max(2).optional(),
      compression: z.enum(['none', 'gzip', 'brotli']).default('none'),
    })
    .optional(),
  json: z
    .object({
      mode: z.enum(['ndjson', 'array']).default('array'),
      compression: z.enum(['none', 'gzip', 'brotli']).default('none'),
    })
    .optional(),
  api: z
    .object({
      url: z.string().url(),
      method: z.enum(['GET', 'POST']).default('GET'),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.record(z.string(), z.unknown()).optional(),
      timeoutMs: z.number().int().min(1000).max(120000).default(20000),
      dataPath: z.string().max(200).optional(),
      nextPagePath: z.string().max(200).optional(),
      maxPages: z.number().int().min(1).max(100000).default(1000),
      minRequestIntervalMs: z.number().int().min(0).max(60000).default(0),
    })
    .optional(),
});

/** Inferred type for ETL ingest request body (use after validate(etlIngestSchema)). */
export type EtlIngestBody = z.infer<typeof etlIngestSchema>;
