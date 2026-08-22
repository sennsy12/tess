import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../lib/api', () => ({
  statisticsApi: {
    byKunde: vi.fn(),
    byVaregruppe: vi.fn(),
    byVare: vi.fn(),
    byLager: vi.fn(),
    byFirma: vi.fn(),
  },
}));

import { statisticsApi } from '../../../lib/api';
import {
  STATISTICS_EXPORT_PAGE_SIZE,
  STATISTICS_EXPORT_ROW_CAP,
  buildStatsExportRows,
  fetchAllStatRows,
} from '../statisticsUtils';

type LooseMock = {
  mockResolvedValueOnce: (value: unknown) => LooseMock;
  mock: { calls: Array<Array<Record<string, unknown>>> };
};

const asLoose = (fn: unknown): LooseMock => fn as unknown as LooseMock;

type StatsRow = Record<string, unknown>;

const apiPayload = (rows: StatsRow[], totalPages: number) => ({
  data: {
    data: rows,
    pagination: {
      page: 1,
      limit: STATISTICS_EXPORT_PAGE_SIZE,
      total: rows.length * totalPages,
      totalPages,
    },
  },
});

describe('fetchAllStatRows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches every page and concatenates rows in order', async () => {
    const byKunde = asLoose(statisticsApi.byKunde);
    byKunde
      .mockResolvedValueOnce(apiPayload([{ kundenavn: 'A', order_count: 1, total_sum: 100 }], 3))
      .mockResolvedValueOnce(apiPayload([{ kundenavn: 'B', order_count: 2, total_sum: 200 }], 3))
      .mockResolvedValueOnce(apiPayload([{ kundenavn: 'C', order_count: 3, total_sum: 300 }], 3));

    const rows = await fetchAllStatRows('kunde', { startDate: '2026-01-01' });

    expect(byKunde.mock.calls).toHaveLength(3);
    expect((rows as unknown as StatsRow[]).map((row) => row.kundenavn)).toEqual(['A', 'B', 'C']);
    expect(byKunde.mock.calls[1]?.[0]).toMatchObject({
      startDate: '2026-01-01',
      page: 2,
      limit: STATISTICS_EXPORT_PAGE_SIZE,
    });
  });

  it('stops at the row cap even when more pages exist', async () => {
    const byVaregruppe = asLoose(statisticsApi.byVaregruppe);
    const maxPages = Math.ceil(STATISTICS_EXPORT_ROW_CAP / STATISTICS_EXPORT_PAGE_SIZE);
    const hugeTotalPages = maxPages + 50;
    const pageRows = Array.from({ length: STATISTICS_EXPORT_PAGE_SIZE }, (_, i) => ({
      varegruppe: `G${i}`,
      order_count: 1,
      total_sum: i,
    }));
    for (let i = 0; i < hugeTotalPages; i += 1) {
      byVaregruppe.mockResolvedValueOnce(apiPayload(pageRows, hugeTotalPages));
    }

    const rows = await fetchAllStatRows('varegruppe', {});

    expect(byVaregruppe.mock.calls).toHaveLength(maxPages);
    expect(rows).toHaveLength(STATISTICS_EXPORT_ROW_CAP);
  });

  it('returns an empty list when the API has no data', async () => {
    asLoose(statisticsApi.byFirma).mockResolvedValueOnce(apiPayload([], 0));

    const rows = await fetchAllStatRows('firma', {});

    expect(rows).toEqual([]);
  });
});

describe('buildStatsExportRows', () => {
  it('maps stat rows to Norwegian CSV headers per grouping type', () => {
    const csvRows = buildStatsExportRows(
      [
        { kundenavn: 'Norsk AS', order_count: 4, total_sum: 1234.5 },
        { order_count: 0, total_sum: 0 },
      ] as unknown as Parameters<typeof buildStatsExportRows>[0],
      'kunde',
    );

    expect(csvRows[0]).toEqual({ Kunde: 'Norsk AS', 'Antall ordrer': 4, 'Total sum': 1234.5 });
    expect(csvRows[1]).toEqual({ Kunde: '', 'Antall ordrer': 0, 'Total sum': 0 });
    expect(Object.keys(csvRows[0])).toEqual(['Kunde', 'Antall ordrer', 'Total sum']);
  });

  it('uses the correct name column for each stat type', () => {
    const csvRows = buildStatsExportRows(
      [{ lagernavn: 'Hovedlager', order_count: 9, total_sum: 99 }] as unknown as Parameters<
        typeof buildStatsExportRows
      >[0],
      'lager',
    );

    expect(Object.keys(csvRows[0])).toContain('Lager');
    expect(csvRows[0]['Lager']).toBe('Hovedlager');
  });
});
