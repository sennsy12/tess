/**
 * Dedupe regression test for the shared approval-count hook.
 *
 * The sidebar badge, the admin dashboard and the approvals page tab strip all
 * mount counts for the same workflow status. They must share ONE request —
 * previously the dashboard and the badge each fired an identical
 * `GET /orders?workflowStatus=pending_approval&limit=1`.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePendingApprovalCount } from '../useApprovals';

vi.mock('../../lib/api/orders', () => ({
  ordersApi: {
    getAll: vi.fn(),
  },
}));

import { ordersApi } from '../../lib/api/orders';

const mockGetAll = ordersApi.getAll as ReturnType<typeof vi.fn>;

function Probe() {
  const { data } = usePendingApprovalCount();
  return <span data-testid="count">{data ?? 0}</span>;
}

function Consumers() {
  return (
    <>
      <Probe />
      <Probe />
      <Probe />
    </>
  );
}

describe('usePendingApprovalCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAll.mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 1, total: 7 } },
    } as never);
  });

  it('sends ONE request even with three mounted consumers', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <Consumers />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      const items = screen.getAllByTestId('count');
      expect(items).toHaveLength(3);
      expect(items.every((el) => el.textContent === '7')).toBe(true);
    });
  });
});