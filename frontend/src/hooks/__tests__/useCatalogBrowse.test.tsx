import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCatalogBrowse } from '../useCatalogBrowse';

const { getAllMock, getGroupsMock } = vi.hoisted(() => ({
  getAllMock: vi.fn(),
  getGroupsMock: vi.fn(),
}));

vi.mock('../../lib/api', () => ({
  catalogApi: { getAll: getAllMock },
  productsApi: { getGroups: getGroupsMock },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

/** Params of the most recent catalog request. */
function lastCatalogCall(): Record<string, unknown> {
  const calls = getAllMock.mock.calls;
  return calls[calls.length - 1][0];
}

describe('useCatalogBrowse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllMock.mockResolvedValue({
      data: { data: [], pagination: { total: 0 } },
    });
    getGroupsMock.mockResolvedValue({ data: [] });
  });

  it('loads page 1 of the catalog with default filters', async () => {
    renderHook(() => useCatalogBrowse(), { wrapper: createWrapper() });

    await waitFor(() => expect(getAllMock).toHaveBeenCalled());
    expect(lastCatalogCall()).toMatchObject({
      page: 1,
      limit: 24,
      search: '',
      varegruppe: '',
    });
  });

  it('debounces search input, trims it and resets to the first page', async () => {
    const { result } = renderHook(() => useCatalogBrowse(), { wrapper: createWrapper() });
    await waitFor(() => expect(getAllMock).toHaveBeenCalled());

    act(() => {
      result.current.setPage(3);
    });
    act(() => {
      result.current.onSearchChange('  bolt  ');
    });

    await waitFor(
      () => {
        expect(lastCatalogCall()).toMatchObject({ search: 'bolt', page: 1 });
      },
      { timeout: 2500 },
    );
  });

  it('applies a varegruppe filter and resets to the first page', async () => {
    const { result } = renderHook(() => useCatalogBrowse(), { wrapper: createWrapper() });
    await waitFor(() => expect(getAllMock).toHaveBeenCalled());

    act(() => {
      result.current.setPage(2);
    });
    act(() => {
      result.current.onVaregruppeChange('Jern');
    });

    await waitFor(
      () => {
        expect(lastCatalogCall()).toMatchObject({ varegruppe: 'Jern', page: 1 });
      },
      { timeout: 2500 },
    );
  });

  it('exposes product groups from the groups query', async () => {
    getGroupsMock.mockResolvedValue({ data: ['Jern', 'Kobber'] });
    const { result } = renderHook(() => useCatalogBrowse(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.groups).toEqual(['Jern', 'Kobber']));
  });
});
