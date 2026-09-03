import unzipper from 'unzipper';
import { SaxesParser } from 'saxes';
import { normalizeHeader } from '../transforms.js';
import { ValidationError } from '../../../middleware/errorHandler.js';

/**
 * Deterministic streaming XLSX reader.
 *
 * Implementation notes (why not exceljs streaming):
 * exceljs 4.x `WorkbookReader` defers worksheets to temp files whenever the
 * sheet entry precedes shared-strings/rels in the archive (which is exactly
 * the order its own writer — and Excel — produces), and that path races with
 * the underlying zip stream. It fails deterministically under jest and can
 * fail under event-loop pressure in production. This reader instead uses
 * random access via the zip central directory (`unzipper.Open.file`, verified
 * fd-leak-free) and streams ONLY the target sheet's XML through a SAX parser
 * (`saxes`). No temp files, no entry-order dependence, O(1) row memory
 * (plus O(unique shared strings) for the string table, which is inherent to
 * the format).
 *
 * Cell semantics mirror the CSV path: everything arrives as text and typed
 * parsing happens downstream in `transforms.ts` (`parseDateLike` also
 * understands Excel date serials, which date-formatted cells surface as).
 */

export interface XlsxRowSourceOptions {
  /** Worksheet name. Defaults to the first worksheet when omitted. */
  sheet?: string;
  /** When resuming, skip this many data rows (after the header) before yielding. */
  skipRows?: number;
  /** When aborted, stop yielding. */
  signal?: AbortSignal;
}

interface XlsxFileEntry {
  path: string;
  buffer: (password?: string) => Promise<Buffer>;
  stream: (password?: string) => unknown;
}

interface XlsxDirectory {
  files: XlsxFileEntry[];
}

/**
 * Convert one plain cell value to text. Shared-string/formula/hyperlink
 * wrappers (as produced by DOM-style readers) are flattened; unknown object
 * shapes map to '' so data is never polluted with "[object Object]".
 */
export function xlsxCellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') {
    // Guard against NaN/Infinity leaking into COPY as literal text.
    return Number.isFinite(value) ? String(value) : '';
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    const yyyy = value.getUTCFullYear();
    const mm = String(value.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(value.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Rich text: { richText: [{ text: 'a' }, ...] }
    if (Array.isArray(obj.richText)) {
      return obj.richText
        .map((part) =>
          typeof part === 'object' && part !== null
            ? String((part as Record<string, unknown>).text ?? '')
            : ''
        )
        .join('');
    }
    // Formula result: { formula: '...', result: ... }
    if (obj.result !== undefined && obj.result !== null) {
      if (typeof obj.result === 'object') return '';
      return xlsxCellToString(obj.result);
    }
    // Hyperlink: { text: '...', hyperlink: '...' }
    if (typeof obj.text === 'string') return obj.text;
    // Error value: { error: '#DIV/0!' } — treat as missing.
    if (typeof obj.error === 'string') return '';
  }
  return '';
}

function fail(message: string, cause?: unknown): never {
  const detail = cause instanceof Error ? `: ${cause.message}` : '';
  throw new ValidationError(`Could not read XLSX file${detail ? ` (${message}${detail})` : `: ${message}`}`);
}

async function openDirectory(filePath: string): Promise<XlsxDirectory> {
  try {
    return (await unzipper.Open.file(filePath)) as unknown as XlsxDirectory;
  } catch (err) {
    return fail('not a readable .xlsx archive', err);
  }
}

function entryMap(directory: XlsxDirectory): Map<string, XlsxFileEntry> {
  const map = new Map<string, XlsxFileEntry>();
  for (const file of directory.files) {
    if (file.path.endsWith('/')) continue;
    if (!map.has(file.path)) map.set(file.path, file);
  }
  return map;
}

/** Parse a small XML document with SAX, collecting events for one pass. */
async function parseXmlDocument(
  xml: string,
  onEvent: (kind: 'open' | 'text' | 'close', name: string, attrs: Record<string, string>, text: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = new SaxesParser();
    parser.on('opentag', (tag) => {
      onEvent('open', tag.name, { ...(tag.attributes as Record<string, string>) }, '');
    });
    parser.on('text', (text) => {
      onEvent('text', '', {}, String(text));
    });
    parser.on('closetag', (tag) => {
      const name = typeof tag === 'string' ? tag : tag.name;
      onEvent('close', name, {}, '');
    });
    parser.on('error', (err) => reject(err));
    parser.on('end', () => resolve());
    try {
      parser.write(xml);
      parser.close();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Load the shared-string table (`xl/sharedStrings.xml`).
 * Bounded by the number of UNIQUE strings in the workbook.
 */
async function loadSharedStrings(entries: Map<string, XlsxFileEntry>): Promise<string[]> {
  const entry = entries.get('xl/sharedStrings.xml');
  if (!entry) return [];
  let xml: string;
  try {
    xml = (await entry.buffer()).toString('utf8');
  } catch (err) {
    return fail('unreadable sharedStrings.xml', err);
  }
  const strings: string[] = [];
  let inItem = false;
  let capture = false;
  let buf = '';
  await parseXmlDocument(xml, (kind, name, _attrs, text) => {
    if (kind === 'open' && name === 'si') {
      inItem = true;
      buf = '';
    } else if (kind === 'open' && name === 't' && inItem) {
      capture = true;
    } else if (kind === 'text' && inItem && capture) {
      buf += text;
    } else if (kind === 'close' && name === 't') {
      capture = false;
    } else if (kind === 'close' && name === 'si') {
      inItem = false;
      capture = false;
      strings.push(buf);
    }
  }).catch((err) => fail('malformed sharedStrings.xml', err));
  return strings;
}

export interface XlsxSheetInfo {
  name: string;
  path: string;
}

/** `worksheets/sheet12.xml` is only trusted when it stays inside xl/worksheets. */
function sanitizeWorksheetPath(target: string): string | null {
  const normalized = target.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..')) return null;
  if (!/^xl\/worksheets\/[^/]+\.xml$/i.test(normalized)) return null;
  return normalized;
}

/**
 * Resolve worksheets in workbook order via `xl/workbook.xml` +
 * `xl/_rels/workbook.xml.rels`. Falls back to scanning
 * `xl/worksheets/sheetN.xml` when the workbook catalog is absent, so
 * degenerate-but-readable files still ingest by position.
 */
async function loadSheetMap(entries: Map<string, XlsxFileEntry>): Promise<XlsxSheetInfo[]> {
  const workbookEntry = entries.get('xl/workbook.xml');
  const relsEntry = entries.get('xl/_rels/workbook.xml.rels');

  if (workbookEntry && relsEntry) {
    try {
      const [workbookXml, relsXml] = await Promise.all([
        workbookEntry.buffer().then((b) => b.toString('utf8')),
        relsEntry.buffer().then((b) => b.toString('utf8')),
      ]);
      const relTargets = new Map<string, string>();
      await parseXmlDocument(relsXml, (kind, name, attrs) => {
        if (kind === 'open' && name === 'Relationship' && attrs.Id && attrs.Target) {
          relTargets.set(attrs.Id, attrs.Target);
        }
      });
      const ordered: { name: string; rid: string }[] = [];
      await parseXmlDocument(workbookXml, (kind, name, attrs) => {
        if (kind === 'open' && name === 'sheet' && attrs.name) {
          ordered.push({ name: attrs.name, rid: attrs['r:id'] ?? '' });
        }
      });
      const sheets: XlsxSheetInfo[] = [];
      ordered.forEach((sheet, index) => {
        const rawTarget = relTargets.get(sheet.rid);
        const resolved = rawTarget ? sanitizeWorksheetPath(`xl/${rawTarget.replace(/^\/+/, '')}`) : null;
        const fallback = `xl/worksheets/sheet${index + 1}.xml`;
        const path = (resolved && entries.has(resolved) ? resolved : null) ?? (entries.has(fallback) ? fallback : null);
        if (path) sheets.push({ name: sheet.name, path });
      });
      if (sheets.length > 0) return sheets;
    } catch {
      // Fall through to positional scan below.
    }
  }

  return [...entries.keys()]
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(p))
    .sort((a, b) => {
      const na = Number(/sheet(\d+)\.xml$/i.exec(a)?.[1] ?? 0);
      const nb = Number(/sheet(\d+)\.xml$/i.exec(b)?.[1] ?? 0);
      return na - nb;
    })
    .map((path, index) => ({ name: `Sheet${index + 1}`, path }));
}

/** `B2` → column 1. Returns null when the ref carries no column letters. */
function columnRefToIndex(ref: string): number | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(ref.trim());
  if (!match) return null;
  let index = 0;
  for (const ch of match[1].toUpperCase()) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index - 1;
}

function coerceCellText(type: string, text: string, sharedStrings: string[]): string {
  const v = text.trim();
  switch (type) {
    case 's': {
      // Shared-string index. Out-of-range/malformed → missing (never throws).
      const idx = /^\d+$/.test(v) ? Number.parseInt(v, 10) : NaN;
      return Number.isInteger(idx) && idx >= 0 && idx < sharedStrings.length
        ? sharedStrings[idx]
        : '';
    }
    case 'inlineStr':
    case 'str':
      return v;
    case 'b':
      return v === '1' ? 'true' : 'false';
    case 'e':
      return '';
    default:
      // 'n' or absent: verbatim text (numbers, incl. date serials, untouched).
      return v;
  }
}

function isRowEmpty(cells: string[]): boolean {
  return cells.every((c) => c.trim() === '');
}

interface RowStreamEvents {
  onRow: (cells: string[]) => void;
  onDone: (err?: Error) => void;
}

/** Feed a sheet entry stream through the SAX row state machine. */
function pumpSheetStream(
  stream: NodeJS.ReadableStream & { destroy: () => void },
  sharedStrings: string[],
  events: RowStreamEvents,
  signal?: AbortSignal
): () => void {
  const parser = new SaxesParser();
  let cells: string[] = [];
  let inRow = false;
  let autoCol = 0;
  let curCol = 0;
  let curType = '';
  let capture = false;
  let buf = '';
  let settled = false;

  const done = (err?: Error): void => {
    if (settled) return;
    settled = true;
    events.onDone(err);
  };

  parser.on('opentag', (tag) => {
    if (tag.name === 'row') {
      inRow = true;
      cells = [];
      autoCol = 0;
    } else if (tag.name === 'c' && inRow) {
      const attrs = tag.attributes as Record<string, string>;
      const fromRef = attrs.r ? columnRefToIndex(attrs.r) : null;
      curCol = fromRef ?? autoCol;
      curType = attrs.t ?? '';
      buf = '';
      capture = false;
    } else if (tag.name === 'v' && inRow) {
      capture = true;
    } else if (tag.name === 't' && inRow) {
      // Inline-string text (<is><t>…).
      capture = true;
    }
  });
  parser.on('text', (text) => {
    if (capture) buf += String(text);
  });
  parser.on('closetag', (tag) => {
    const name = typeof tag === 'string' ? tag : tag.name;
    if (name === 'v' || name === 't') {
      capture = false;
    } else if (name === 'c' && inRow) {
      capture = false;
      cells[curCol] = coerceCellText(curType, buf, sharedStrings);
      if (curCol >= autoCol) autoCol = curCol + 1;
      buf = '';
    } else if (name === 'row' && inRow) {
      inRow = false;
      const snapshot = cells.slice();
      if (!isRowEmpty(snapshot)) events.onRow(snapshot);
      cells = [];
    }
  });
  parser.on('error', (err) => {
    try {
      stream.destroy();
    } catch {
      /* ignore */
    }
    done(err as Error);
  });

  stream.on('data', (chunk: Buffer) => {
    try {
      parser.write(chunk);
    } catch (err) {
      try {
        stream.destroy();
      } catch {
        /* ignore */
      }
      done(err as Error);
    }
  });
  stream.on('end', () => {
    try {
      parser.close();
    } catch (err) {
      done(err as Error);
      return;
    }
    done();
  });
  stream.on('error', (err: Error) => done(err));

  const onAbort = (): void => {
    try {
      stream.destroy();
    } catch {
      /* ignore */
    }
    done(new DOMException('XLSX ingest aborted', 'AbortError'));
  };
  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener('abort', onAbort, { once: true });
  }
  return () => {
    signal?.removeEventListener('abort', onAbort);
    try {
      stream.destroy();
    } catch {
      /* ignore */
    }
  };
}

/**
 * Stream one worksheet's rows as string arrays (header included, empty rows
 * excluded). The entry stream is always destroyed when iteration ends —
 * early exits cannot leak file handles because this module owns the stream.
 */
async function* streamSheetRows(
  sheetEntry: XlsxFileEntry,
  sharedStrings: string[],
  signal?: AbortSignal
): AsyncGenerator<string[]> {
  let stream: NodeJS.ReadableStream & { destroy: () => void };
  try {
    stream = (await sheetEntry.stream()) as NodeJS.ReadableStream & { destroy: () => void };
  } catch (err) {
    return fail('unreadable worksheet stream', err);
  }
  if (!stream || typeof stream.on !== 'function') {
    return fail('unreadable worksheet stream');
  }

  const queue: string[][] = [];
  let wake: (() => void) | null = null;
  let finished = false;
  let failure: Error | null = null;
  const notify = (): void => {
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  const cleanup = pumpSheetStream(
    stream,
    sharedStrings,
    {
      onRow: (cells) => {
        queue.push(cells);
        notify();
      },
      onDone: (err) => {
        failure = err ?? null;
        finished = true;
        notify();
      },
    },
    signal
  );

  try {
    for (;;) {
      while (queue.length > 0) {
        if (signal?.aborted) {
          throw new DOMException('XLSX ingest aborted', 'AbortError');
        }
        yield queue.shift() as string[];
      }
      if (failure) throw failure;
      if (finished) return;
      if (signal?.aborted) {
        throw new DOMException('XLSX ingest aborted', 'AbortError');
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
  } finally {
    cleanup();
  }
}

async function resolveSheet(
  filePath: string,
  sheet?: string
): Promise<{ sheetEntry: XlsxFileEntry; sharedStrings: string[]; availableSheets: string[] }> {
  const directory = await openDirectory(filePath);
  const entries = entryMap(directory);
  const sheets = await loadSheetMap(entries);
  const availableSheets = sheets.map((s) => s.name);

  let selected: XlsxSheetInfo | undefined;
  if (sheet !== undefined) {
    selected = sheets.find((s) => s.name === sheet);
    if (!selected) {
      const available = availableSheets.length > 0 ? ` Available sheets: ${availableSheets.join(', ')}` : '';
      throw new ValidationError(`XLSX sheet "${sheet}" not found.${available}`);
    }
  } else {
    selected = sheets[0];
    if (!selected) {
      throw new ValidationError('XLSX file contains no worksheets');
    }
  }

  const sheetEntry = entries.get(selected.path);
  if (!sheetEntry) {
    throw new ValidationError(`XLSX sheet "${selected.name}" is unreadable`);
  }
  const sharedStrings = await loadSharedStrings(entries);
  return { sheetEntry, sharedStrings, availableSheets };
}

export async function collectSheetNames(filePath: string): Promise<string[]> {
  const directory = await openDirectory(filePath);
  const sheets = await loadSheetMap(entryMap(directory));
  return sheets.map((s) => s.name);
}

/**
 * Peek at the header row of an XLSX worksheet without loading the file.
 * Only the rows up to the first non-empty one are parsed.
 */
export async function peekXlsxHeaders(filePath: string, sheet?: string): Promise<string[]> {
  const { sheetEntry, sharedStrings } = await resolveSheet(filePath, sheet);
  try {
    for await (const cells of streamSheetRows(sheetEntry, sharedStrings)) {
      if (!isRowEmpty(cells)) return cells;
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    return fail('unreadable worksheet', err);
  }
  if (sheet !== undefined) {
    throw new ValidationError(`XLSX sheet "${sheet}" contains no header row`);
  }
  throw new ValidationError('XLSX file contains no header row');
}

/**
 * Stream data rows from an XLSX worksheet as plain records.
 *
 * The first non-empty row is treated as the header (keys are
 * `normalizeHeader`-normalized, mirroring `csvSource`). Memory stays flat:
 * rows are mapped and yielded one at a time, never buffered.
 */
export async function* xlsxRowSource(
  filePath: string,
  options: XlsxRowSourceOptions = {}
): AsyncGenerator<Record<string, unknown>> {
  const { sheet, skipRows = 0, signal } = options;
  const { sheetEntry, sharedStrings } = await resolveSheet(filePath, sheet);

  let headers: string[] | null = null;
  let skipped = 0;
  try {
    for await (const cells of streamSheetRows(sheetEntry, sharedStrings, signal)) {
      if (isRowEmpty(cells)) continue;
      if (headers === null) {
        headers = cells.map((h) => normalizeHeader(h.replace(/"/g, '')));
        continue;
      }
      if (skipped < skipRows) {
        skipped += 1;
        continue;
      }
      const record: Record<string, unknown> = {};
      for (let i = 0; i < headers.length; i += 1) {
        record[headers[i]] = cells[i] ?? '';
      }
      yield record;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    if (err instanceof ValidationError) throw err;
    throw new ValidationError(`Could not read XLSX file: ${(err as Error).message}`);
  }

  if (headers === null) {
    throw new ValidationError('XLSX file contains no header row');
  }
}
