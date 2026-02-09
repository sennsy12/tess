import fs from 'fs';
import readline from 'readline';
import { parse } from 'csv-parse';
import pool, { bulkCopy } from '../db/index.js';

type CsvRow = Record<string, string>;
type TableName = 'ordre' | 'ordrelinje' | 'kunde' | 'vare' | 'firma' | 'lager';

const SUPPORTED_TABLES: TableName[] = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

const HEADER_TO_COLUMN: Record<string, string> = {
  ordrenr: 'ordrenr',
  dato: 'dato',
  kundenr: 'kundenr',
  kundenavn: 'kundenavn',
  kunderef: 'kunderef',
  valuta: 'valutaid',
  valutaid: 'valutaid',
  kundeordreref: 'kundeordreref',
  'sum eksl. mva': 'sum',
  sum: 'sum',
  linjenr: 'linjenr',
  firma: 'firmaid',
  firmaid: 'firmaid',
  lager: 'lagernavn',
  lagernavn: 'lagernavn',
  vare: 'varekode',
  varekode: 'varekode',
  varenavn: 'varenavn',
  antall: 'antall',
  enhet: 'enhet',
  netpris: 'nettpris',
  nettpris: 'nettpris',
  linjesum: 'linjesum',
  status: 'linjestatus',
  linjestatus: 'linjestatus',
  varegruppe: 'varegruppe',
};

const INTEGER_COLUMNS = new Set(['ordrenr', 'linjenr', 'firmaid', 'linjestatus']);
const DECIMAL_COLUMNS = new Set(['sum', 'nettpris', 'linjesum', 'antall']);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseIntegerLike(value: string): number | null {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDecimalLike(value: string): number | null {
  const compact = (value || '').replace(/[\u00A0\s]/g, '');
  if (!compact) return null;

  let normalized = compact;
  if (normalized.includes(',') && normalized.includes('.')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (normalized.includes(',')) {
    normalized = normalized.replace(',', '.');
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateLike(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split('.');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

function parseStatusToInt(value: string): number {
  const v = (value || '').trim().toLowerCase();
  if (!v) return 1;

  if (['aktiv', 'active', 'ny', 'new', 'åpen', 'apen', 'open'].includes(v)) return 1;
  if (['inaktiv', 'inactive', 'lukket', 'closed', 'kansellert', 'cancelled'].includes(v)) return 0;

  const numeric = parseIntegerLike(v);
  return numeric ?? 1;
}

function toDbColumn(header: string): string {
  return HEADER_TO_COLUMN[header] ?? header;
}

async function detectSeparatorAndHeaders(filePath: string): Promise<{ separator: string; headers: string[] }> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, terminal: false });

  const firstLine = await new Promise<string>((resolve, reject) => {
    rl.on('line', (line) => {
      rl.close();
      resolve(line);
    });
    rl.on('error', reject);
  });

  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const separator = semicolonCount > commaCount ? ';' : ',';
  const headers = firstLine.split(separator).map(h => normalizeHeader(h.replace(/"/g, '')));
  return { separator, headers };
}

function detectTargetTable(headers: string[]): TableName {
  if (headers.includes('ordrenr') && headers.includes('linjenr')) return 'ordrelinje';

  const candidates: Record<TableName, string[]> = {
    ordre: ['ordrenr', 'dato', 'kundenr'],
    ordrelinje: ['linjenr', 'ordrenr', 'vare'],
    kunde: ['kundenr', 'kundenavn'],
    vare: ['vare', 'varenavn'],
    firma: ['firma'],
    lager: ['lager', 'firma'],
  };

  for (const table of SUPPORTED_TABLES) {
    const score = candidates[table].filter(h => headers.includes(h)).length;
    if (score >= Math.min(2, candidates[table].length)) return table;
  }

  throw new Error(`Kunne ikke identifisere tabell fra headere: ${headers.join(', ')}`);
}

async function parseCsvRows(filePath: string, separator: string): Promise<CsvRow[]> {
  const rows: CsvRow[] = [];
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      delimiter: separator,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      columns: (header: string[]) => header.map(h => normalizeHeader(h)),
    })
  );

  for await (const record of parser) {
    rows.push(record as CsvRow);
  }

  return rows;
}

async function getValidColumns(tableName: TableName): Promise<Set<string>> {
  const result = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2`,
    ['public', tableName]
  );
  return new Set(result.rows.map((r: { column_name: string }) => r.column_name));
}

async function insertBatchOnConflictDoNothing(
  table: string,
  columns: string[],
  rows: Array<Array<string | number | null>>,
  conflictClause: string,
  batchSize = 1000
): Promise<void> {
  if (rows.length === 0) return;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const placeholders: string[] = [];
      const values: Array<string | number | null> = [];

      batch.forEach((row, rowIndex) => {
        const rowPlaceholders = row.map((_, colIndex) => `$${rowIndex * columns.length + colIndex + 1}`);
        placeholders.push(`(${rowPlaceholders.join(', ')})`);
        values.push(...row);
      });

      const sql = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders.join(', ')}
        ON CONFLICT ${conflictClause} DO NOTHING
      `;

      await client.query(sql, values);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensureReferenceData(rows: CsvRow[]): Promise<void> {
  const kunder = new Map<string, string | null>();
  const firmaer = new Map<number, string | null>();
  const lagre = new Set<string>();
  const valutaer = new Set<string>();
  const varer = new Map<string, { varenavn: string | null; varegruppe: string | null }>();

  for (const row of rows) {
    const kundenr = (row.kundenr || '').trim();
    if (kundenr) kunder.set(kundenr, (row.kundenavn || '').trim() || null);

    const firmaid = parseIntegerLike(row.firma || row.firmaid || '');
    if (firmaid !== null) {
      const firmanavn = (row.firma || '').trim() || `Firma ${firmaid}`;
      firmaer.set(firmaid, firmanavn);
    }

    const lagernavn = (row.lager || row.lagernavn || '').trim();
    if (lagernavn && firmaid !== null) lagre.add(`${lagernavn}|${firmaid}`);

    const valutaid = (row.valuta || row.valutaid || '').trim().toUpperCase();
    if (valutaid) valutaer.add(valutaid);

    const varekode = (row.vare || row.varekode || '').trim();
    if (varekode) {
      varer.set(varekode, {
        varenavn: (row.varenavn || '').trim() || null,
        varegruppe: (row.varegruppe || '').trim() || null,
      });
    }
  }

  await insertBatchOnConflictDoNothing(
    'valuta',
    ['valutaid'],
    Array.from(valutaer).map(v => [v]),
    '(valutaid)'
  );

  await insertBatchOnConflictDoNothing(
    'firma',
    ['firmaid', 'firmanavn'],
    Array.from(firmaer.entries()).map(([firmaid, firmanavn]) => [firmaid, firmanavn]),
    '(firmaid)'
  );

  await insertBatchOnConflictDoNothing(
    'kunde',
    ['kundenr', 'kundenavn'],
    Array.from(kunder.entries()).map(([kundenr, kundenavn]) => [kundenr, kundenavn]),
    '(kundenr)'
  );

  await insertBatchOnConflictDoNothing(
    'vare',
    ['varekode', 'varenavn', 'varegruppe'],
    Array.from(varer.entries()).map(([varekode, v]) => [varekode, v.varenavn, v.varegruppe]),
    '(varekode)'
  );

  const lagerRows = Array.from(lagre).map((key) => {
    const [lagernavn, firmaid] = key.split('|');
    return [lagernavn, Number(firmaid)] as Array<string | number>;
  });
  await insertBatchOnConflictDoNothing(
    'lager',
    ['lagernavn', 'firmaid'],
    lagerRows,
    '(lagernavn, firmaid)'
  );
}

function buildColumnPlan(headers: string[], validColumns: Set<string>): Array<{ csvHeader: string; dbColumn: string }> {
  const seen = new Set<string>();
  const plan: Array<{ csvHeader: string; dbColumn: string }> = [];

  for (const header of headers) {
    const mapped = toDbColumn(header);
    if (!validColumns.has(mapped) || seen.has(mapped)) continue;
    seen.add(mapped);
    plan.push({ csvHeader: header, dbColumn: mapped });
  }

  return plan;
}

function transformValue(column: string, raw: string, rowIndex: number): string | number | null {
  const value = (raw || '').trim().replace(/^"|"$/g, '');

  if (column === 'dato') return parseDateLike(value);
  if (column === 'linjestatus') return parseStatusToInt(value);

  if (INTEGER_COLUMNS.has(column)) {
    if (column === 'linjenr') return parseIntegerLike(value) ?? (rowIndex + 1);
    if (column === 'firmaid') return parseIntegerLike(value) ?? 1;
    return parseIntegerLike(value);
  }

  if (DECIMAL_COLUMNS.has(column)) return parseDecimalLike(value);
  return value === '' ? null : value;
}

async function insertRowsForTable(
  tableName: TableName,
  headers: string[],
  rows: CsvRow[]
): Promise<{ insertedRows: number; attemptedRows: number }> {
  const validColumns = await getValidColumns(tableName);
  const columnPlan = buildColumnPlan(headers, validColumns);
  if (columnPlan.length === 0) {
    throw new Error(`Ingen matchende kolonner funnet for tabell ${tableName}`);
  }

  const dbColumns = columnPlan.map(c => c.dbColumn);
  const transformedRows: Array<Array<string | number | null>> = [];

  rows.forEach((row, rowIndex) => {
    const values = columnPlan.map(({ csvHeader, dbColumn }) => transformValue(dbColumn, row[csvHeader] ?? '', rowIndex));
    const valueByCol = new Map<string, string | number | null>();
    dbColumns.forEach((col, idx) => valueByCol.set(col, values[idx]));

    if (tableName === 'ordre') {
      if (valueByCol.get('ordrenr') === null) return;
    }
    if (tableName === 'ordrelinje') {
      if (valueByCol.get('ordrenr') === null || valueByCol.get('linjenr') === null) return;
    }

    transformedRows.push(values);
  });

  const attemptedRows = transformedRows.length;
  if (attemptedRows === 0) return { insertedRows: 0, attemptedRows: 0 };
  const insertedRows = await bulkCopy(tableName, dbColumns, transformedRows, 'nothing');
  return { insertedRows, attemptedRows };
}

/**
 * Uploads CSV to inferred/selected table with robust parsing and normalization.
 */
export async function uploadCsvToTable(
  filePath: string,
  providedTable?: string
): Promise<{ duration: number; table: string; rowCount: number; attemptedRows: number }> {
  const startTime = Date.now();
  const { separator, headers } = await detectSeparatorAndHeaders(filePath);
  const rows = await parseCsvRows(filePath, separator);
  const detectedTable = providedTable ? (providedTable as TableName) : detectTargetTable(headers);

  if (!SUPPORTED_TABLES.includes(detectedTable)) {
    throw new Error(`Unsupported table: ${detectedTable}`);
  }

  await ensureReferenceData(rows);

  let rowCount = 0;
  let attemptedRows = 0;
  if (!providedTable && detectedTable === 'ordrelinje' && headers.includes('ordrenr') && headers.includes('linjenr')) {
    await insertRowsForTable('ordre', headers, rows);
    const result = await insertRowsForTable('ordrelinje', headers, rows);
    rowCount = result.insertedRows;
    attemptedRows = result.attemptedRows;
  } else {
    const result = await insertRowsForTable(detectedTable, headers, rows);
    rowCount = result.insertedRows;
    attemptedRows = result.attemptedRows;
  }

  const duration = Date.now() - startTime;
  return { duration, table: detectedTable, rowCount, attemptedRows };
}
