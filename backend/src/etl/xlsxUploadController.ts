import { runStreamingEtl } from './streaming/pipeline.js';
import { runCombinedOrderXlsxEtl } from './streaming/pipeline/combinedOrderXlsx.js';
import { peekXlsxHeaders } from './streaming/sources/xlsxSource.js';
import { normalizeHeader } from './streaming/transforms.js';
import { SUPPORTED_TABLES, detectTargetTable } from './csvUploadController.js';
import type { EtlTableName } from './streaming/types.js';

export interface XlsxUploadOptions {
  /** Worksheet name. Defaults to the first worksheet when omitted. */
  sheet?: string;
  /** Explicit target table. When omitted it is detected from the header row. */
  table?: string;
}

/**
 * Uploads an XLSX worksheet to the inferred/selected table with the
 * streaming COPY pipeline (O(1) memory regardless of file size).
 *
 * Header detection streams only the first rows (see `peekXlsxHeaders`); the
 * full ingest then re-reads the file once — the same two-pass pattern the
 * CSV uploader uses (first-line sniff + full pass).
 */
export async function uploadXlsxToTable(
  filePath: string,
  options: XlsxUploadOptions = {}
): Promise<{ duration: number; table: string; rowCount: number; attemptedRows: number; rejectedRows: number }> {
  const startTime = Date.now();
  const rawHeaders = await peekXlsxHeaders(filePath, options.sheet);
  const headers = rawHeaders.map((h) => normalizeHeader(h.replace(/"/g, '')));
  const detectedTable = options.table
    ? (options.table as EtlTableName)
    : detectTargetTable(headers);

  if (!SUPPORTED_TABLES.includes(detectedTable)) {
    throw new Error(`Unsupported table: ${detectedTable}`);
  }

  // For combined order+line worksheets (one row per order line, with order
  // fields repeated): single-pass fan-out reads the file once and feeds
  // ordre + ordrelinje COPY streams in parallel; ordre commits before the
  // ordrelinje merge (FK-safe).
  if (!options.table && detectedTable === 'ordrelinje' && headers.includes('ordrenr') && headers.includes('linjenr')) {
    const combined = await runCombinedOrderXlsxEtl({ filePath, sheet: options.sheet });
    return {
      duration: Date.now() - startTime,
      table: detectedTable,
      rowCount: combined.ordrelinjeInserted,
      attemptedRows: combined.attemptedRows,
      rejectedRows: combined.rejectedOrdrelinjeRows,
    };
  }

  const result = await runStreamingEtl({
    sourceType: 'xlsx',
    table: detectedTable,
    xlsx: { filePath, sheet: options.sheet },
    onConflict: 'nothing',
    strictMode: false,
  });
  const insertedRows = result.insertedRows;
  const attemptedRows = result.attemptedRows;
  const rejectedRows = result.rejectedRows;

  const duration = Date.now() - startTime;
  return {
    duration,
    table: detectedTable,
    rowCount: insertedRows,
    attemptedRows,
    rejectedRows,
  };
}
