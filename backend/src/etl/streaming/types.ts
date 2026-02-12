export type EtlTableName = 'ordre' | 'ordrelinje' | 'kunde' | 'vare' | 'firma' | 'lager';

export type EtlSourceType = 'csv' | 'json' | 'api';

export type JsonInputMode = 'ndjson' | 'array';

export interface ApiSourceConfig {
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeoutMs?: number;
  dataPath?: string;
  nextPagePath?: string;
  maxPages?: number;
}

export interface JsonSourceConfig {
  filePath: string;
  mode?: JsonInputMode;
}

export interface CsvSourceConfig {
  filePath: string;
  delimiter?: string;
}

export interface StreamingEtlRequest {
  sourceType: EtlSourceType;
  table: EtlTableName;
  onConflict?: 'nothing' | 'error';
  strictMode?: boolean;
  sourceMapping?: Record<string, string>;
  csv?: CsvSourceConfig;
  json?: JsonSourceConfig;
  api?: ApiSourceConfig;
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
}
