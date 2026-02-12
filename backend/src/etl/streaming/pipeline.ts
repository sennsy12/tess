import { copyFromLineStream, getTableColumns } from '../../db/index.js';
import { etlLogger } from '../../lib/logger.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { recordEtlRun } from '../etlMetrics.js';
import { apiRowSource } from './sources/apiSource.js';
import { csvRowSource } from './sources/csvSource.js';
import { jsonRowSource } from './sources/jsonSource.js';
import {
  buildColumnPlan,
  formatCopyLine,
  isRowValid,
  normalizeHeader,
  normalizeRecord,
  transformValue,
} from './transforms.js';
import {
  ColumnPlanItem,
  EtlSourceType,
  StreamingEtlRequest,
  StreamingEtlResult,
} from './types.js';

type SourceStream = AsyncGenerator<Record<string, unknown>>;

function getSourceStream(config: StreamingEtlRequest): SourceStream {
  if (config.sourceType === 'csv') {
    if (!config.csv?.filePath) {
      throw new ValidationError('csv.filePath is required for csv source');
    }
    return csvRowSource(config.csv.filePath, config.csv.delimiter);
  }

  if (config.sourceType === 'json') {
    if (!config.json?.filePath) {
      throw new ValidationError('json.filePath is required for json source');
    }
    return jsonRowSource(config.json.filePath, config.json.mode ?? 'array');
  }

  if (config.sourceType === 'api') {
    if (!config.api?.url) {
      throw new ValidationError('api.url is required for api source');
    }
    return apiRowSource(config.api);
  }

  throw new ValidationError(`Unsupported source type: ${String(config.sourceType)}`);
}

function mapRow(
  row: Record<string, unknown>,
  rowIndex: number,
  table: string,
  strictMode: boolean,
  columnPlan: ColumnPlanItem[]
): Array<string | number | null> | null {
  const normalized = normalizeRecord(row);
  const values = columnPlan.map(({ sourceKey, dbColumn }) => {
    const raw = normalized[normalizeHeader(sourceKey)] ?? '';
    return transformValue(dbColumn, raw, rowIndex);
  });

  const valueByColumn = new Map<string, string | number | null>();
  columnPlan.forEach((item, idx) => valueByColumn.set(item.dbColumn, values[idx]));
  const valid = isRowValid(table as any, valueByColumn);
  if (!valid && strictMode) {
    throw new ValidationError(`Invalid row at index ${rowIndex} for table ${table}`);
  }
  return valid ? values : null;
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
    } catch (error: any) {
      attempt += 1;
      if (attempt > maxRetries) throw error;
      const delayMs = 300 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 120);
      etlLogger.warn({ label, attempt, delayMs, error: error?.message }, 'Retrying ETL operation');
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function runStreamingEtl(config: StreamingEtlRequest): Promise<StreamingEtlResult> {
  const start = Date.now();
  const validColumns = await getTableColumns(config.table);
  const source = getSourceStream(config);
  const iterator = source[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) {
    const emptyResult: StreamingEtlResult = {
      table: config.table,
      durationMs: Date.now() - start,
      attemptedRows: 0,
      insertedRows: 0,
      rejectedRows: 0,
      rowsPerSecond: 0,
      sourceType: config.sourceType,
      columns: [],
    };
    recordEtlRun(emptyResult);
    return emptyResult;
  }

  const firstRow = first.value;
  const firstKeys = Object.keys(normalizeRecord(firstRow));
  const columnPlan = buildColumnPlan(firstKeys, validColumns, config.sourceMapping);
  if (columnPlan.length === 0) {
    throw new ValidationError(`No matching columns found for table ${config.table}`);
  }

  let attemptedRows = 0;
  let rejectedRows = 0;
  const strictMode = config.strictMode ?? false;

  async function* lineGenerator(): AsyncGenerator<string> {
    const firstValues = mapRow(firstRow, attemptedRows, config.table, strictMode, columnPlan);
    attemptedRows += 1;
    if (firstValues) {
      yield formatCopyLine(firstValues);
    } else {
      rejectedRows += 1;
    }

    let rowIndex = attemptedRows;
    while (true) {
      const next = await iterator.next();
      if (next.done) break;
      const values = mapRow(next.value, rowIndex, config.table, strictMode, columnPlan);
      attemptedRows += 1;
      rowIndex += 1;
      if (values) {
        yield formatCopyLine(values);
      } else {
        rejectedRows += 1;
      }
    }
  }

  let insertedRows = 0;
  insertedRows = await withRetries(
    () =>
      copyFromLineStream(
        config.table,
        columnPlan.map((c) => c.dbColumn),
        lineGenerator(),
        config.onConflict ?? 'nothing'
      ),
    `copy-${config.table}`
  );

  const durationMs = Date.now() - start;
  const rowsPerSecond = durationMs > 0 ? Number(((insertedRows * 1000) / durationMs).toFixed(2)) : 0;
  const result: StreamingEtlResult = {
    table: config.table,
    durationMs,
    attemptedRows,
    insertedRows,
    rejectedRows,
    rowsPerSecond,
    sourceType: config.sourceType as EtlSourceType,
    columns: columnPlan.map((c) => c.dbColumn),
  };

  etlLogger.info(
    {
      stage: 'streaming-etl-complete',
      table: result.table,
      sourceType: result.sourceType,
      attemptedRows: result.attemptedRows,
      insertedRows: result.insertedRows,
      rejectedRows: result.rejectedRows,
      durationMs: result.durationMs,
      rowsPerSecond: result.rowsPerSecond,
    },
    'Streaming ETL run completed'
  );
  recordEtlRun(result);
  return result;
}
