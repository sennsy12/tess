jest.mock('../../db/index', () => ({
  getTableColumns: jest.fn(),
  copyFromLineStream: jest.fn(),
}));

jest.mock('../streaming/sources/xlsxSource', () => ({
  xlsxRowSource: jest.fn(),
}));

jest.mock('../etlMetrics', () => ({
  recordEtlRun: jest.fn(),
}));

import { runStreamingEtl } from '../streaming/pipeline';
import { copyFromLineStream, getTableColumns } from '../../db/index';
import { xlsxRowSource } from '../streaming/sources/xlsxSource';

const mockGetTableColumns = getTableColumns as jest.MockedFunction<typeof getTableColumns>;
const mockCopyFromLineStream = copyFromLineStream as jest.MockedFunction<typeof copyFromLineStream>;
const mockXlsxSource = xlsxRowSource as jest.MockedFunction<typeof xlsxRowSource>;

async function* rows(records: Record<string, unknown>[]) {
  for (const record of records) {
    yield record;
  }
}

describe('runStreamingEtl with xlsx source', () => {
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

  it('runs xlsx source pipeline and forwards sheet option', async () => {
    mockXlsxSource.mockReturnValue(
      rows([
        { ordrenr: '1', dato: '2026-01-01', kundenr: 'K001' },
        { ordrenr: '2', dato: '2026-01-02', kundenr: 'K002' },
      ])
    );

    const result = await runStreamingEtl({
      sourceType: 'xlsx',
      table: 'ordre',
      xlsx: { filePath: 'orders.xlsx', sheet: 'Ordre' },
    });

    expect(result.sourceType).toBe('xlsx');
    expect(result.table).toBe('ordre');
    expect(result.attemptedRows).toBe(2);
    expect(result.insertedRows).toBe(2);
    expect(mockXlsxSource).toHaveBeenCalledWith(
      'orders.xlsx',
      expect.objectContaining({ sheet: 'Ordre' })
    );
    expect(mockCopyFromLineStream).toHaveBeenCalledWith(
      'ordre',
      ['ordrenr', 'dato', 'kundenr'],
      expect.anything(),
      'nothing',
      expect.objectContaining({ progressInterval: 5000 })
    );
  });

  it('throws when xlsx.filePath is missing', async () => {
    await expect(
      runStreamingEtl({ sourceType: 'xlsx', table: 'ordre' })
    ).rejects.toThrow(/xlsx\.filePath is required/);
    expect(mockCopyFromLineStream).not.toHaveBeenCalled();
  });
});
