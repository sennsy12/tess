/**
 * Tester for useTablePreferences: server-sannhet, debouncet lagring,
 * legacy-migrering og stille fallback.
 */
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useTablePreferences, PREF_SAVE_DEBOUNCE_MS } from '../useTablePreferences';
import { tablePreferencesApi } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  tablePreferencesApi: {
    get: vi.fn(),
    save: vi.fn(),
  },
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'admin', role: 'admin' } }),
}));

const mockGet = tablePreferencesApi.get as unknown as ReturnType<typeof vi.fn>;
const mockSave = tablePreferencesApi.save as unknown as ReturnType<typeof vi.fn>;

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const DEFAULTS = ['ordrenr', 'dato', 'kunderef'];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('useTablePreferences', () => {
  it('bruker serververdier når de finnes', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        tableKey: 'admin-orders',
        visibleColumns: ['ordrenr', 'kunderef'],
        columnLabels: { kunderef: 'Deres ref' },
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const { result } = renderHook(
      () => useTablePreferences('admin-orders', { defaultVisibleKeys: DEFAULTS }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.visibleKeys).toEqual(['ordrenr', 'kunderef']);
    });
    expect(result.current.columnLabels).toEqual({ kunderef: 'Deres ref' });
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('faller tilbake til defaults når serveren er tom', async () => {
    mockGet.mockResolvedValueOnce({
      data: { tableKey: 'admin-orders', visibleColumns: null, columnLabels: {}, updatedAt: null },
    });

    const { result } = renderHook(
      () => useTablePreferences('admin-orders', { defaultVisibleKeys: DEFAULTS }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.visibleKeys).toEqual(DEFAULTS);
    });
    expect(result.current.columnLabels).toEqual({});
  });

  it('ignorerer ukjente kolonnenøkler fra server', async () => {
    mockGet.mockResolvedValueOnce({
      data: {
        tableKey: 'admin-orders',
        visibleColumns: ['ordrenr', 'slettet-kolonne'],
        columnLabels: { 'slettet-kolonne': 'X' },
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const { result } = renderHook(
      () =>
        useTablePreferences('admin-orders', {
          defaultVisibleKeys: DEFAULTS,
          knownKeys: DEFAULTS,
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.visibleKeys).toEqual(['ordrenr']);
    });
    expect(result.current.columnLabels).toEqual({});
  });

  it('lagrer debouncet etter endring (ikke per klikk)', async () => {
    mockGet.mockResolvedValueOnce({
      data: { tableKey: 'admin-orders', visibleColumns: null, columnLabels: {}, updatedAt: null },
    });
    mockSave.mockResolvedValue({
      data: {
        tableKey: 'admin-orders',
        visibleColumns: ['ordrenr', 'dato'],
        columnLabels: {},
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const { result } = renderHook(
      () => useTablePreferences('admin-orders', { defaultVisibleKeys: DEFAULTS }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.visibleKeys).toEqual(DEFAULTS);
    });

    // Fake timers kun rundt debounce-vinduet – waitFor over trenger ekte tid.
    vi.useFakeTimers();
    try {
      act(() => {
        result.current.setVisibleKeys(['ordrenr', 'dato']);
        result.current.setVisibleKeys(['ordrenr']);
      });
      expect(mockSave).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(PREF_SAVE_DEBOUNCE_MS + 100);
      });

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(
        'admin-orders',
        expect.objectContaining({ visibleColumns: ['ordrenr'] }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('migrerer legacy localStorage til server én gang', async () => {
    localStorage.setItem(
      'table:admin-orders',
      JSON.stringify({ visibleColumnKeys: ['ordrenr', 'dato'] }),
    );
    mockGet.mockResolvedValueOnce({
      data: { tableKey: 'admin-orders', visibleColumns: null, columnLabels: {}, updatedAt: null },
    });
    mockSave.mockResolvedValue({
      data: {
        tableKey: 'admin-orders',
        visibleColumns: ['ordrenr', 'dato'],
        columnLabels: {},
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    });

    const { result } = renderHook(
      () =>
        useTablePreferences('admin-orders', {
          defaultVisibleKeys: DEFAULTS,
          legacyStorageKey: 'table:admin-orders',
        }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledWith(
        'admin-orders',
        expect.objectContaining({ visibleColumns: ['ordrenr', 'dato'] }),
      );
    });
    expect(result.current.visibleKeys).toEqual(['ordrenr', 'dato']);
  });

  it('fungerer stille med defaults når serveren feiler', async () => {
    mockGet.mockRejectedValueOnce(new Error('nettverksfeil'));

    const { result } = renderHook(
      () => useTablePreferences('admin-orders', { defaultVisibleKeys: DEFAULTS }),
      { wrapper: wrapper() },
    );

    await waitFor(() => {
      expect(result.current.visibleKeys).toEqual(DEFAULTS);
    });
    expect(result.current.columnLabels).toEqual({});
    // Hooken retry-er én gang før den gir opp – vent til feilen har landet.
    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
      },
      { timeout: 5000 },
    );
  });
});
