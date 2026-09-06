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
import { etlLogger } from '../../lib/logger';

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

describe('xlsx sparse and merged cells', () => {
  it('maps gaps to empty strings and ignores columns past the header width', async () => {
    const file = await writeWorkbook('gaps.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.getCell('A1').value = 'KundeNr';
      ws.getCell('B1').value = 'Sum';
      ws.getCell('A2').value = 'K001';
      ws.getCell('C2').value = 5;
    });

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ kundenr: 'K001', sum: '' });
  });

  it('reads merged cells without crashing (top-left value wins)', async () => {
    const file = await writeWorkbook('merged.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['KundeNr', 'Navn']);
      ws.addRow(['K001', 'Acme']);
      ws.mergeCells('A2:B2');
    });

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kundenr: 'K001' });
  });
});

describe('xlsx formulas and rich text', () => {
  it('treats formulas without cached result as missing (never throws)', async () => {
    const file = await writeWorkbook('formula.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['Antall', 'Dobbel']);
      ws.getCell('A2').value = 21;
      ws.getCell('B2').value = { formula: 'A2*2' };
    });

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ antall: '21', dobbel: '' });
  });

  it('concatenates multi-run rich text', async () => {
    const file = await writeWorkbook('richtext.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['Navn']);
      ws.getCell('A2').value = { richText: [{ text: 'Hei ' }, { text: 'verden' }] };
    });

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ navn: 'Hei verden' });
  });

  it('preserves interior whitespace and round-trips very long cells', async () => {
    const long = `x${'y'.repeat(100_000)}z`;
    const file = await writeWorkbook('odd.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['Navn', 'Notat']);
      ws.addRow(['Kunde  AS', long]);
    });

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ navn: 'Kunde  AS', notat: long });
  });
});

// ── Hand-rolled stored (uncompressed) zip writer ──────────────────────
// No zip-writing dependency exists in the repo; stored entries need no
// compression, so ~60 lines suffice for degenerate/corrupt fixtures.

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function writeStoredZip(entries: Array<{ name: string; data: string | Buffer }>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = typeof entry.data === 'string' ? Buffer.from(entry.data, 'utf8') : entry.data;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, data);

    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(data.length, 20);
    header.writeUInt32LE(data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, name);
    offset += local.length + name.length + data.length;
  }
  const cd = Buffer.concat(central);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  const entryCount = entries.length;
  endRecord.writeUInt16LE(entryCount, 8);
  endRecord.writeUInt16LE(entryCount, 10);
  endRecord.writeUInt32LE(cd.length, 12);
  endRecord.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, endRecord]);
}

function escXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function sheetXml(rows: Array<Array<{ ref: string; t?: string; v: string }>>): string {
  const body = rows
    .map(
      (cells, i) =>
        `<row r="${i + 1}">` +
        cells
          .map((c) => `<c r="${c.ref}"${c.t ? ` t="${c.t}"` : ''}><v>${escXml(c.v)}</v></c>`)
          .join('') +
        `</row>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet><sheetData>${body}</sheetData></worksheet>`;
}

function workbookXml(sheets: Array<{ name: string; rid: string }>): string {
  const body = sheets
    .map((s, i) => `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="${s.rid}"/>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><workbook><sheets>${body}</sheets></workbook>`;
}

function relsXml(rels: Array<{ id: string; target: string }>): string {
  const body = rels
    .map(
      (r) =>
        `<Relationship Id="${escXml(r.id)}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${escXml(r.target)}"/>`
    )
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?><Relationships>${body}</Relationships>`;
}

async function writeRawZip(name: string, entries: Array<{ name: string; data: string | Buffer }>): Promise<string> {
  const filePath = path.join(tmpDir, name);
  await fs.promises.writeFile(filePath, writeStoredZip(entries));
  return filePath;
}

const SIMPLE_SHEET = sheetXml([
  [
    { ref: 'A1', t: 'inlineStr', v: 'KundeNr' },
    { ref: 'B1', t: 'inlineStr', v: 'Sum' },
  ],
  [
    { ref: 'A2', t: 'inlineStr', v: 'K001' },
    { ref: 'B2', v: '5' },
  ],
]);

describe('xlsx degenerate archives', () => {
  it('falls back to positional scan when workbook catalog is absent', async () => {
    const file = await writeRawZip('no-catalog.zip.xlsx', [
      { name: 'xl/worksheets/sheet1.xml', data: SIMPLE_SHEET },
    ]);

    expect(await collectSheetNames(file)).toEqual(['Sheet1']);
    const rows = await collect(xlsxRowSource(file));
    expect(rows).toEqual([{ kundenr: 'K001', sum: '5' }]);
  });

  it('falls back with a warning when the catalog is corrupt', async () => {
    const warn = jest.spyOn(etlLogger, 'warn').mockImplementation(() => undefined);
    try {
      const file = await writeRawZip('corrupt-catalog.zip.xlsx', [
        { name: 'xl/workbook.xml', data: '<workbook><sheets><sheet name="Data"' },
        { name: 'xl/_rels/workbook.xml.rels', data: relsXml([{ id: 'rId1', target: 'worksheets/sheet1.xml' }]) },
        { name: 'xl/worksheets/sheet1.xml', data: SIMPLE_SHEET },
      ]);

      const rows = await collect(xlsxRowSource(file));
      expect(rows).toEqual([{ kundenr: 'K001', sum: '5' }]);
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it('never follows traversal targets out of xl/worksheets', async () => {
    const evilSheet = sheetXml([
      [
        { ref: 'A1', t: 'inlineStr', v: 'KundeNr' },
        { ref: 'B1', t: 'inlineStr', v: 'Sum' },
      ],
      [
        { ref: 'A2', t: 'inlineStr', v: 'EVIL' },
        { ref: 'B2', v: '0' },
      ],
    ]);
    for (const target of ['../evil.xml', '..\\evil.xml']) {
      const file = await writeRawZip(`traversal-${target.length}.zip.xlsx`, [
        { name: 'xl/workbook.xml', data: workbookXml([{ name: 'Data', rid: 'rId1' }]) },
        { name: 'xl/_rels/workbook.xml.rels', data: relsXml([{ id: 'rId1', target }]) },
        { name: 'xl/worksheets/sheet1.xml', data: SIMPLE_SHEET },
        { name: 'xl/worksheets/..foo.xml', data: evilSheet },
        { name: 'evil.xml', data: evilSheet },
      ]);

      // Traversal target rejected → positional fallback serves the real sheet.
      const rows = await collect(xlsxRowSource(file, { sheet: 'Data' }));
      expect(rows).toEqual([{ kundenr: 'K001', sum: '5' }]);
    }
  });

  it('fails loudly (ValidationError) on truncated sheet XML', async () => {
    const file = await writeRawZip('truncated.zip.xlsx', [
      { name: 'xl/worksheets/sheet1.xml', data: SIMPLE_SHEET.slice(0, 120) },
    ]);

    await expect(collect(xlsxRowSource(file))).rejects.toThrow(ValidationError);
  });
});

describe('xlsx backpressure integration', () => {
  it('streams thousands of rows to completion (pause/resume must engage)', async () => {
    const file = await writeWorkbook('big.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['KundeNr', 'Sum']);
      for (let i = 0; i < 2500; i += 1) ws.addRow([`K${i}`, i]);
    });

    const rows = await collect(xlsxRowSource(file));
    expect(rows).toHaveLength(2500);
    expect(rows[0]).toEqual({ kundenr: 'K0', sum: '0' });
    expect(rows[2499]).toEqual({ kundenr: 'K2499', sum: '2499' });
  });

  it('aborts mid-stream with a slow consumer (no hang on paused stream)', async () => {
    const file = await writeWorkbook('abort-mid.xlsx', (wb) => {
      const ws = wb.addWorksheet('Data');
      ws.addRow(['KundeNr']);
      for (let i = 0; i < 200; i += 1) ws.addRow([`K${i}`]);
    });

    const controller = new AbortController();
    let seen = 0;
    await expect(
      (async () => {
        for await (const row of xlsxRowSource(file, { signal: controller.signal })) {
          void row;
          seen += 1;
          if (seen === 5) controller.abort();
        }
      })()
    ).rejects.toThrow(expect.objectContaining({ name: 'AbortError' }));
    expect(seen).toBe(5);
  });
});
