import fs from 'fs';
import os from 'os';
import path from 'path';
import ExcelJS from 'exceljs';
import {
  collectSheetNames,
  peekXlsxHeaders,
  xlsxCellToString,
  xlsxRowSource,
} from '../streaming/sources/xlsxSource';
import { parseDateLike, parseExcelSerialDate } from '../streaming/transforms';
import { ValidationError } from '../../middleware/errorHandler';

let tmpDir: string;

async function writeWorkbook(
  name: string,
  build: (wb: ExcelJS.Workbook) => void
): Promise<string> {
  const wb = new ExcelJS.Workbook();
  build(wb);
  const filePath = path.join(tmpDir, name);
  await wb.xlsx.writeFile(filePath);
  return filePath;
}

async function collect(
  gen: AsyncGenerator<Record<string, unknown>>
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for await (const row of gen) out.push(row);
  return out;
}

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'xlsx-test-'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('xlsxCellToString', () => {
  it('passes through strings, numbers and booleans', () => {
    expect(xlsxCellToString('K001')).toBe('K001');
    expect(xlsxCellToString(1001)).toBe('1001');
    expect(xlsxCellToString(1234.5)).toBe('1234.5');
    expect(xlsxCellToString(true)).toBe('true');
    expect(xlsxCellToString(false)).toBe('false');
  });

  it('maps null/undefined/NaN to empty string', () => {
    expect(xlsxCellToString(null)).toBe('');
    expect(xlsxCellToString(undefined)).toBe('');
    expect(xlsxCellToString(NaN)).toBe('');
  });

  it('formats Date cells as yyyy-mm-dd without timezone shift', () => {
    expect(xlsxCellToString(new Date(Date.UTC(2026, 0, 15)))).toBe('2026-01-15');
    expect(xlsxCellToString(new Date(NaN))).toBe('');
  });

  it('flattens rich text, formula results and hyperlinks', () => {
    expect(
      xlsxCellToString({ richText: [{ text: 'Hei ' }, { text: 'verden' }] })
    ).toBe('Hei verden');
    expect(xlsxCellToString({ formula: '1+1', result: 2 })).toBe('2');
    expect(xlsxCellToString({ text: 'Klikk', hyperlink: 'https://x' })).toBe('Klikk');
  });

  it('treats error values and unknown objects as missing', () => {
    expect(xlsxCellToString({ error: '#DIV/0!' })).toBe('');
    expect(xlsxCellToString({ some: 'object' })).toBe('');
  });
});

describe('parseExcelSerialDate', () => {
  it('converts serials (with and without time fraction)', () => {
    // NB: real Excel date cells are timezone-naive calendar serials
    // (15.01.2026 in Excel === 46037). Fractional .958-style values only
    // arise from tz-aware Date round-trips, not from user-entered dates.
    expect(parseExcelSerialDate('46037.95')).toBe('2026-01-15');
    expect(parseExcelSerialDate('46037')).toBe('2026-01-15');
    expect(parseExcelSerialDate('46037.333')).toBe('2026-01-15');
    expect(parseExcelSerialDate('32874')).toBe('1990-01-01');
  });

  it('rejects non-numeric and out-of-range input', () => {
    expect(parseExcelSerialDate('')).toBeNull();
    expect(parseExcelSerialDate('2026-01-15')).toBeNull();
    expect(parseExcelSerialDate('123')).toBeNull();
    expect(parseExcelSerialDate('999999')).toBeNull();
    expect(parseExcelSerialDate('abc')).toBeNull();
  });

  it('parseDateLike keeps existing formats and gains serial support', () => {
    expect(parseDateLike('2026-01-15')).toBe('2026-01-15');
    expect(parseDateLike('15.01.2026')).toBe('2026-01-15');
    expect(parseDateLike('46037.95')).toBe('2026-01-15');
    expect(parseDateLike('')).toBeNull();
    expect(parseDateLike('not a date')).toBeNull();
  });
});

describe('peekXlsxHeaders', () => {
  it('returns headers from the first worksheet by default', async () => {
    const file = await writeWorkbook('headers.xlsx', (wb) => {
      const ws = wb.addWorksheet('Ordre');
      ws.addRow(['OrdreNr', 'Dato', 'KundeNr']);
      ws.addRow([1, '2026-01-01', 'K001']);
    });
    await expect(peekXlsxHeaders(file)).resolves.toEqual([
      'OrdreNr',
      'Dato',
      'KundeNr',
    ]);
  });

  it('returns headers from a named worksheet', async () => {
    const file = await writeWorkbook('named.xlsx', (wb) => {
      const a = wb.addWorksheet('Annet');
      a.addRow(['a']);
      const k = wb.addWorksheet('Kunde');
      k.addRow(['KundeNr', 'KundeNavn']);
    });
    await expect(peekXlsxHeaders(file, 'Kunde')).resolves.toEqual([
      'KundeNr',
      'KundeNavn',
    ]);
  });

  it('throws ValidationError listing sheets for unknown sheet', async () => {
    const file = await writeWorkbook('unknown-sheet.xlsx', (wb) => {
      wb.addWorksheet('Kunde').addRow(['KundeNr']);
    });
    await expect(peekXlsxHeaders(file, 'FinnesIkke')).rejects.toThrow(
      ValidationError
    );
    await expect(peekXlsxHeaders(file, 'FinnesIkke')).rejects.toThrow(/Kunde/);
  });

  it('throws ValidationError when there is no header row', async () => {
    const file = await writeWorkbook('empty.xlsx', (wb) => {
      wb.addWorksheet('Tom');
    });
    await expect(peekXlsxHeaders(file)).rejects.toThrow(ValidationError);
  });
});

describe('xlsxRowSource', () => {
  it('yields normalized records and skips empty rows', async () => {
    const file = await writeWorkbook('rows.xlsx', (wb) => {
      const ws = wb.addWorksheet('Ordre');
      ws.addRow(['OrdreNr', 'Dato', 'KundeNr', 'Sum eksl. mva']);
      ws.addRow([1001, '2026-01-15', 'K001', 1234.5]);
      ws.addRow([]);
      ws.addRow([1002, '2026-02-01', 'K002', 99.9]);
    });

    const rows = await collect(xlsxRowSource(file));
    // Keys are normalizeHeader-normalized (like csvSource); the
    // 'sum eksl. mva' → 'sum' DB mapping happens later in buildColumnPlan.
    expect(rows).toEqual([
      { ordrenr: '1001', dato: '2026-01-15', kundenr: 'K001', 'sum eksl. mva': '1234.5' },
      { ordrenr: '1002', dato: '2026-02-01', kundenr: 'K002', 'sum eksl. mva': '99.9' },
    ]);
  });

  it('reads the selected worksheet and honors skipRows', async () => {
    const file = await writeWorkbook('sheets.xlsx', (wb) => {
      const a = wb.addWorksheet('Annet');
      a.addRow(['a']);
      a.addRow([1]);
      const k = wb.addWorksheet('Kunde');
      k.addRow(['KundeNr', 'KundeNavn']);
      k.addRow(['K001', 'Acme']);
      k.addRow(['K002', 'Globex']);
    });

    const all = await collect(xlsxRowSource(file, { sheet: 'Kunde' }));
    expect(all).toHaveLength(2);
    expect(all[0]).toEqual({ kundenr: 'K001', kundenavn: 'Acme' });

    const skipped = await collect(
      xlsxRowSource(file, { sheet: 'Kunde', skipRows: 1 })
    );
    expect(skipped).toEqual([{ kundenr: 'K002', kundenavn: 'Globex' }]);
  });

  it('aborts on signal', async () => {
    const file = await writeWorkbook('abort.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['KundeNr']);
      for (let i = 0; i < 10; i += 1) ws.addRow([`K${i}`]);
    });

    const controller = new AbortController();
    controller.abort();
    await expect(collect(xlsxRowSource(file, { signal: controller.signal }))).rejects.toThrow(
      expect.objectContaining({ name: 'AbortError' })
    );
  });

  it('throws ValidationError for unknown sheet', async () => {
    const file = await writeWorkbook('no-sheet.xlsx', (wb) => {
      wb.addWorksheet('Kunde').addRow(['KundeNr']);
    });
    await expect(collect(xlsxRowSource(file, { sheet: 'Nei' }))).rejects.toThrow(
      ValidationError
    );
  });

  it('handles native date serials, booleans and special sheet names', async () => {
    const file = await writeWorkbook('native.xlsx', (wb) => {
      const ws = wb.addWorksheet('Ordre & Data');
      ws.addRow(['OrdreNr', 'Dato', 'Aktiv']);
      // A real date-formatted cell is stored as a serial, not text.
      ws.addRow([7, new Date(Date.UTC(2026, 4, 20)), true]);
      ws.addRow([8, new Date(Date.UTC(2026, 4, 21)), false]);
    });

    expect(await peekXlsxHeaders(file, 'Ordre & Data')).toEqual([
      'OrdreNr',
      'Dato',
      'Aktiv',
    ]);
    expect(await collectSheetNames(file)).toEqual(['Ordre & Data']);

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(2);
    // Serials survive verbatim; parseDateLike maps them to calendar dates.
    expect(parseDateLike(String(rows[0].dato))).toBe('2026-05-20');
    expect(parseDateLike(String(rows[1].dato))).toBe('2026-05-21');
    expect(rows[0]).toMatchObject({ ordrenr: '7', aktiv: 'true' });
    expect(rows[1]).toMatchObject({ ordrenr: '8', aktiv: 'false' });
  });
});
