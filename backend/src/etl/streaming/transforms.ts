import { ColumnPlanItem, EtlTableName } from './types.js';

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

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeRecord(record: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[normalizeHeader(key)] = value === null || value === undefined ? '' : String(value);
  }
  return normalized;
}

export function parseIntegerLike(value: string): number | null {
  const digits = (value || '').replace(/\D/g, '');
  if (!digits) return null;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDecimalLike(value: string): number | null {
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

export function parseDateLike(value: string): string | null {
  const v = (value || '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(v)) {
    const [dd, mm, yyyy] = v.split('.');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  return null;
}

export function parseStatusToInt(value: string): number {
  const v = (value || '').trim().toLowerCase();
  if (!v) return 1;
  if (['aktiv', 'active', 'ny', 'new', 'apen', 'open', 'åpen'].includes(v)) return 1;
  if (['inaktiv', 'inactive', 'lukket', 'closed', 'kansellert', 'cancelled'].includes(v)) return 0;
  return parseIntegerLike(v) ?? 1;
}

function toDbColumn(header: string): string {
  return HEADER_TO_COLUMN[header] ?? header;
}

export function buildColumnPlan(
  sourceKeys: string[],
  validColumns: Set<string>,
  sourceMapping?: Record<string, string>
): ColumnPlanItem[] {
  const plan: ColumnPlanItem[] = [];
  const seen = new Set<string>();

  const mappingPairs = sourceMapping
    ? Object.entries(sourceMapping).map(([source, db]) => [normalizeHeader(source), normalizeHeader(db)] as const)
    : [];

  for (const [sourceKey, dbColumnRaw] of mappingPairs) {
    if (!validColumns.has(dbColumnRaw) || seen.has(dbColumnRaw)) continue;
    seen.add(dbColumnRaw);
    plan.push({ sourceKey, dbColumn: dbColumnRaw });
  }

  for (const rawKey of sourceKeys) {
    const sourceKey = normalizeHeader(rawKey);
    const explicit = sourceMapping?.[sourceKey];
    const mapped = explicit ? normalizeHeader(explicit) : toDbColumn(sourceKey);
    if (!validColumns.has(mapped) || seen.has(mapped)) continue;
    seen.add(mapped);
    plan.push({ sourceKey, dbColumn: mapped });
  }

  return plan;
}

export function transformValue(column: string, rawValue: string, rowIndex: number): string | number | null {
  const value = (rawValue || '').trim().replace(/^"|"$/g, '');
  if (column === 'dato') return parseDateLike(value);
  if (column === 'linjestatus') return parseStatusToInt(value);

  if (INTEGER_COLUMNS.has(column)) {
    if (column === 'linjenr') return parseIntegerLike(value) ?? rowIndex + 1;
    if (column === 'firmaid') return parseIntegerLike(value) ?? 1;
    return parseIntegerLike(value);
  }
  if (DECIMAL_COLUMNS.has(column)) return parseDecimalLike(value);
  return value === '' ? null : value;
}

export function isRowValid(table: EtlTableName, valueByColumn: Map<string, string | number | null>): boolean {
  const reason = getRowValidationError(table, valueByColumn);
  return reason === null;
}

/** Returns validation error message or null if valid. Used for dead-letter reporting. */
export function getRowValidationError(
  table: EtlTableName,
  valueByColumn: Map<string, string | number | null>
): string | null {
  if (table === 'ordre') {
    if (valueByColumn.get('ordrenr') === null) return 'missing ordrenr';
    return null;
  }
  if (table === 'ordrelinje') {
    if (valueByColumn.get('ordrenr') === null) return 'missing ordrenr';
    if (valueByColumn.get('linjenr') === null) return 'missing linjenr';
    return null;
  }
  if (table === 'kunde') {
    if (valueByColumn.get('kundenr') === null) return 'missing kundenr';
    return null;
  }
  if (table === 'vare') {
    if (valueByColumn.get('varekode') === null) return 'missing varekode';
    return null;
  }
  if (table === 'firma') {
    if (valueByColumn.get('firmaid') === null) return 'missing firmaid';
    return null;
  }
  if (table === 'lager') {
    if (valueByColumn.get('lagernavn') === null) return 'missing lagernavn';
    if (valueByColumn.get('firmaid') === null) return 'missing firmaid';
    return null;
  }
  return null;
}

export function formatCopyValue(value: unknown): string {
  if (value === null || value === undefined) return '\\N';
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\t/g, '\\t')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r');
}

export function formatCopyLine(values: Array<string | number | null>): string {
  return `${values.map(formatCopyValue).join('\t')}\n`;
}
