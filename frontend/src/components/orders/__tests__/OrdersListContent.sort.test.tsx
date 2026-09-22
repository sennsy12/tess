/**
 * Server-side sorting tests for <OrdersListContent />.
 *
 * Previously only the admin variant sent `sortBy/sortDir` to the server, so
 * kunde users sorted just the currently loaded page (50 rows) client-side —
 * a misleading "sort all columns" experience. These tests pin the behaviour
 * that BOTH variants now delegate sorting to the server, whose column
 * whitelist (`ORDER_SORT_COLUMNS`) plus kunde row-scoping make it safe.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrdersListContent } from '../OrdersListContent';

vi.mock('../../../lib/api/orders', () => ({
  ordersApi: { getAll: vi.fn() },
}));

vi.mock('../../../lib/api/suggestions', () => ({
  suggestionsApi: { search: vi.fn() },
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 2, username: 'kunde1', role: 'kunde', kundenr: 'K001' } }),
}));

vi.mock('../../../hooks/useTablePreferences', () => ({
  useTablePreferences: () => ({
    visibleKeys: ['ordrenr', 'dato', 'kundenavn', 'kunderef', 'firmanavn', 'lagernavn', 'valutaid', 'workflow_status', 'sum'],
    columnLabels: {},
    isLoading: false,
    setVisibleKeys: vi.fn(),
    setLabel: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useSavedViews', () => ({
  useSavedViews: () => ({
    views: [],
    defaultView: null,
    canUseShared: false,
    isLoading: false,
    saveView: vi.fn(),
    deleteView: vi.fn(),
    setDefaultView: vi.fn(),
  }),
}));

import { ordersApi } from '../../../lib/api/orders';

const mockGetAll = ordersApi.getAll as ReturnType<typeof vi.fn>;

const ORDERS = [
  { ordrenr: 10001, dato: '2026-08-01', kundenavn: 'Kunde A', sum: 1500, workflow_status: 'invoiced' },
  { ordrenr: 10002, dato: '2026-08-05', kundenavn: 'Kunde B', sum: 2500, workflow_status: 'processing' },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAll.mockResolvedValue({
    data: { data: ORDERS, pagination: { page: 1, limit: 50, total: ORDERS.length } },
  } as never);
});

function renderList(variant: 'admin' | 'kunde') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/${variant}`]}>
        <OrdersListContent variant={variant} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OrdersListContent — server-side sorting', () => {
  it('kunde: sends sortBy/sortDir to the server when a column header is clicked', async () => {
    const user = userEvent.setup();
    renderList('kunde');

    // Initial load: no sort params, role-scoped list works.
    await screen.findAllByText('#10001');
    expect(mockGetAll).toHaveBeenCalledTimes(1);
    expect(mockGetAll).toHaveBeenCalledWith({ page: 1, limit: 50 });

    // Clicking "Sum" must trigger a server-sorted refetch, not local sorting.
    await user.click(screen.getByRole('button', { name: 'Sum' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, limit: 50, sortBy: 'sum', sortDir: 'asc' }),
      );
    });
  });

  it('kunde: toggles to descending on second click', async () => {
    const user = userEvent.setup();
    renderList('kunde');

    await screen.findAllByText('#10001');
    await user.click(screen.getByRole('button', { name: 'Sum' }));
    await user.click(screen.getByRole('button', { name: 'Sum' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'sum', sortDir: 'desc' }),
      );
    });
  });

  it('admin: still sends sortBy/sortDir (regression guard)', async () => {
    const user = userEvent.setup();
    renderList('admin');

    await screen.findByText('#10001');
    await user.click(screen.getByRole('button', { name: 'Ordrenr' }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenLastCalledWith(
        expect.objectContaining({ sortBy: 'ordrenr', sortDir: 'asc' }),
      );
    });
  });
});
