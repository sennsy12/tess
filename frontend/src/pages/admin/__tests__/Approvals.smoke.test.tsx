/**
 * Smoke tests for the admin approvals queue page.
 *
 * Verifies the page mounts, fetches with the right query params, renders
 * order rows, and that selecting rows enables the bulk action bar.
 * API layer is mocked; routing/query providers are real.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminApprovals } from '../Approvals';

vi.mock('../../../lib/api', () => ({
  ordersApi: {
    getAll: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ordersApi } from '../../../lib/api';

const mockGetAll = ordersApi.getAll as ReturnType<typeof vi.fn>;

function makeOrder(overrides: Partial<{ ordrenr: number; sum: number }> = {}) {
  return {
    ordrenr: 10001,
    kundenr: 'K001',
    workflow_status: 'pending_approval',
    status_updated_at: new Date().toISOString(),
    dato: '2026-08-01',
    sum: 1500,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/approvals']}>
        <AdminApprovals />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // Shape mirrors axios + buildListResponse: queryFn returns response.data.
  mockGetAll.mockResolvedValue({
    data: {
      data: [makeOrder({ ordrenr: 10001 }), makeOrder({ ordrenr: 10002, sum: 2500 })],
      pagination: { page: 1, limit: 50, total: 2 },
    },
  } as never);
});

describe('AdminApprovals (smoke)', () => {
  it('fetches pending approvals and renders order rows', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('#10001')).toBeInTheDocument();
    });
    expect(screen.getByText('#10002')).toBeInTheDocument();
    expect(mockGetAll).toHaveBeenCalledWith(
      expect.objectContaining({ workflowStatus: 'pending_approval' })
    );
  });

  it('selects rows and shows the bulk action count', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('#10001');

    // Row checkbox for the first order (select-all is a separate control).
    await user.click(screen.getByLabelText('Velg ordre 10001'));

    await waitFor(() => {
      expect(screen.getByText('1 valgt')).toBeInTheDocument();
    });
  });

  it('switches tabs to query a different workflow status', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('#10001');
    mockGetAll.mockClear();

    // Tab buttons include a live count: "Ny(2)" - label from ORDER_WORKFLOW_LABELS.
    await user.click(screen.getByRole('button', { name: /^Ny\(/ }));

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledWith(
        expect.objectContaining({ workflowStatus: 'new' })
      );
    });
  });
});
