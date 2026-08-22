/**
 * Regression: clicking a statistics row drills down (kunde → vare) without
 * crashing. Guards the row-click → setFilters/setStatType path that renders
 * placeholder (previous-group) data while the next query loads.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Component, ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatisticsPage } from '../StatisticsPage';

vi.mock('../../../lib/api', () => ({
  statisticsApi: {
    summary: vi.fn(),
    byKunde: vi.fn(),
    byVaregruppe: vi.fn(),
    byVare: vi.fn(),
    byLager: vi.fn(),
    byFirma: vi.fn(),
  },
  ordersApi: { getAll: vi.fn() },
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 1, username: 'admin', role: 'admin' } }),
}));

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('../components', async (importOriginal) => {
  const original = await importOriginal<typeof import('../components')>();
  return {
    ...original,
    // Charts pull in lazy recharts chunks — irrelevant to this behaviour.
    StatsCharts: () => <div data-testid="charts-stub" />,
  };
});

import { statisticsApi } from '../../../lib/api';

const kundeRows = [
  { kundenr: 'K001', kundenavn: 'Akershus AS', order_count: 12, total_sum: 45000 },
  { kundenr: 'K002', kundenavn: 'Bergen OH', order_count: 5, total_sum: 12000 },
];

class ProbeBoundary extends Component<
  { children: ReactNode; onError: (e: Error) => void },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    this.props.onError(error);
  }
  render() {
    return this.state.hasError ? <div>PROBE_CAUGHT</div> : this.props.children;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  (statisticsApi.byKunde as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { data: kundeRows, pagination: { page: 1, limit: 25, total: 2, totalPages: 1 } },
  });
  (statisticsApi.byVare as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: {
      data: [{ varekode: 'V-1', varenavn: 'Bolt', order_count: 3, total_sum: 900 }],
      pagination: { page: 1, limit: 25, total: 1, totalPages: 1 },
    },
  });
  (statisticsApi.summary as ReturnType<typeof vi.fn>).mockResolvedValue({
    data: { totalRevenue: 57000, totalOrders: 17, activeCustomers: 2 },
  });
});

describe('StatisticsPage row drill-down', () => {
  it('clicking a kunde row switches to vare stats without crashing', async () => {
    let crash: Error | null = null;
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <ProbeBoundary onError={(e) => (crash = e)}>
        <QueryClientProvider client={qc}>
          <MemoryRouter initialEntries={['/admin/statistics']}>
            <StatisticsPage />
          </MemoryRouter>
        </QueryClientProvider>
      </ProbeBoundary>
    );

    const row = await screen.findByText('Akershus AS');
    fireEvent.click(row.closest('tr')!);

    // Drill-down triggered a vare query for the clicked customer.
    await waitFor(() => {
      expect(statisticsApi.byVare).toHaveBeenCalledWith(
        expect.objectContaining({ kundenr: 'K001' })
      );
    });

    expect(screen.queryByText('PROBE_CAUGHT')).not.toBeInTheDocument();
    expect(crash).toBeNull();
  });
});
