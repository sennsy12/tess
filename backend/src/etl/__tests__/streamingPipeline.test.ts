jest.mock('../../db/index', () => ({
  getTableColumns: jest.fn(),
  copyFromLineStream: jest.fn(),
}));

jest.mock('../streaming/sources/csvSource', () => ({
  csvRowSource: jest.fn(),
}));

jest.mock('../streaming/sources/jsonSource', () => ({
  jsonRowSource: jest.fn(),
}));

jest.mock('../streaming/sources/apiSource', () => ({
  apiRowSource: jest.fn(),
}));

jest.mock('../etlMetrics', () => ({
  recordEtlRun: jest.fn(),
}));

import { runStreamingEtl } from '../streaming/pipeline';
import { copyFromLineStream, getTableColumns } from '../../db/index';
import { csvRowSource } from '../streaming/sources/csvSource';
import { jsonRowSource } from '../streaming/sources/jsonSource';
import { apiRowSource } from '../streaming/sources/apiSource';

const mockGetTableColumns = getTableColumns as jest.MockedFunction<typeof getTableColumns>;
const mockCopyFromLineStream = copyFromLineStream as jest.MockedFunction<typeof copyFromLineStream>;
const mockCsvSource = csvRowSource as jest.MockedFunction<typeof csvRowSource>;
const mockJsonSource = jsonRowSource as jest.MockedFunction<typeof jsonRowSource>;
const mockApiSource = apiRowSource as jest.MockedFunction<typeof apiRowSource>;

async function* rows(records: Record<string, unknown>[]) {
  for (const record of records) {
    yield record;
  }
}

describe('runStreamingEtl', () => {
  beforeEach(() => {
    mockGetTableColumns.mockResolvedValue(new Set(['ordrenr', 'dato', 'kundenr']));
    mockCopyFromLineStream.mockImplementation(async (_table, _columns, source) => {
      let count = 0;
      for await (const _line of source as AsyncIterable<string>) {
        count += 1;
      }
      return count;
    });
  });

  it('runs csv source pipeline and forwards formatted line stream to COPY', async () => {
    mockCsvSource.mockReturnValue(rows([
      { ordrenr: '1', dato: '2026-01-01', kundenr: 'K001' },
      { ordrenr: '2', dato: '2026-01-02', kundenr: 'K002' },
    ]));

    const result = await runStreamingEtl({
      sourceType: 'csv',
      table: 'ordre',
      csv: { filePath: 'dummy.csv' },
    });

    expect(result.table).toBe('ordre');
    expect(result.attemptedRows).toBe(2);
    expect(result.insertedRows).toBe(2);
    expect(mockCopyFromLineStream).toHaveBeenCalledWith(
      'ordre',
      ['ordrenr', 'dato', 'kundenr'],
      expect.anything(),
      'nothing',
      expect.objectContaining({ progressInterval: 5000 })
    );
  });

  it('runs json source pipeline', async () => {
    mockJsonSource.mockReturnValue(rows([
      { ordrenr: '5', dato: '2026-02-01', kundenr: 'K005' },
    ]));

    const result = await runStreamingEtl({
      sourceType: 'json',
      table: 'ordre',
      json: { filePath: 'rows.ndjson', mode: 'ndjson' },
      onConflict: 'error',
    });

    expect(result.sourceType).toBe('json');
    expect(result.attemptedRows).toBe(1);
    expect(mockCopyFromLineStream).toHaveBeenCalledWith(
      'ordre',
      ['ordrenr', 'dato', 'kundenr'],
      expect.anything(),
      'error',
      expect.objectContaining({ progressInterval: 5000 })
    );
  });

  it('runs api source pipeline', async () => {
    mockApiSource.mockReturnValue(rows([
      { ordrenr: '10', dato: '2026-03-01', kundenr: 'K010' },
    ]));

    const result = await runStreamingEtl({
      sourceType: 'api',
      table: 'ordre',
      api: { url: 'https://example.com/orders' },
    });

    expect(result.sourceType).toBe('api');
    expect(result.attemptedRows).toBe(1);
  });

  it('throws when onConflict is upsert without upsertKeyColumns', async () => {
    mockCsvSource.mockReturnValue(rows([{ ordrenr: '1', dato: '2026-01-01', kundenr: 'K001' }]));
    await expect(
      runStreamingEtl({
        sourceType: 'csv',
        table: 'ordre',
        csv: { filePath: 'dummy.csv' },
        onConflict: 'upsert',
      })
    ).rejects.toThrow(/upsert.*requires upsertKeyColumns/);
    expect(mockCopyFromLineStream).not.toHaveBeenCalled();
  });

  it('runs with onConflict upsert when upsertKeyColumns provided', async () => {
    mockCsvSource.mockReturnValue(rows([
      { ordrenr: '1', dato: '2026-01-01', kundenr: 'K001' },
      { ordrenr: '2', dato: '2026-01-02', kundenr: 'K002' },
    ]));
    const result = await runStreamingEtl({
      sourceType: 'csv',
      table: 'ordre',
      csv: { filePath: 'dummy.csv' },
      onConflict: 'upsert',
      upsertKeyColumns: ['ordrenr'],
    });
    expect(result.insertedRows).toBe(2);
    expect(mockCopyFromLineStream).toHaveBeenCalledWith(
      'ordre',
      ['ordrenr', 'dato', 'kundenr'],
      expect.anything(),
      'upsert',
      expect.objectContaining({
        upsertKeyColumns: ['ordrenr'],
        progressInterval: 5000,
      })
    );
  });
});
