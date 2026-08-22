/**
 * Smoke test for the kunde dashboard page.
 *
 * Verifies the page mounts, fetches its four queries, greets the logged-in
 * customer, and renders KPI values from the summary response. Charts and the
 * app shell (Layout/ExportButton) are stubbed — they carry recharts/jsPDF
 * weight irrelevant to this page's logic.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { KundeDashboard } from '../Dashboard';

vi.mock('../../../lib/api', () => ({
  statisticsApi: {
    summary: vi.fn(),
    byVaregruppe: vi.fn(),
    timeSeries: vi.fn(),
  },
  ordersApi: {
    getAll: vi.fn(),
  },
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 2, username: 'kunde1', role: 'kunde', kundenr: 'K001' } }),
}));

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/Charts', () => ({
  LineChart: () => <div data-testid="line-chart" />,
  PieChart: () => <div data-testid="pie-chart" />,
}));

vi.mock('../../../components/ExportButton', () => ({
  ExportButton: () => <button type="button">Eksporter</button>,
}));

import { statisticsApi, ordersApi } from '../../../lib/api';

const mockSummary = statisticsApi.summary as ReturnType<typeof vi.fn>;
const mockByVaregruppe = statisticsApi.byVaregruppe as ReturnType<typeof vi.fn>;
const mockTimeSeries = statisticsApi.timeSeries as ReturnType<typeof vi.fn>;
const mockGetAll = ordersApi.getAll as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSummary.mockResolvedValue({
    data: {
      total_orders: 42,
      total_sum: 125000,
      total_products: 318,
      average_order_value: 2976.19,
    },
  } as never);
  mockByVaregruppe.mockResolvedValue({ data: [] } as never);
  mockTimeSeries.mockResolvedValue({ data: [] } as never);
  // queryFn handles both axios-wrapped and bare list shapes.
  mockGetAll.mockResolvedValue({
    data: {
      data: [
        { ordrenr: 10001, dato: '2026-08-01', sum: 1500, workflow_status: 'invoiced' },
        { ordrenr: 10002, dato: '2026-08-05', sum: 2500, workflow_status: 'processing' },
      ],
      pagination: { page: 1, limit: 5, total: 2 },
    },
  } as never);
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/kunde']}>
        <KundeDashboard />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('KundeDashboard (smoke)', () => {
  it('greets the customer by kundenr', async () => {
    renderPage();
    expect(await screen.findByText(/Velkommen, K001!/)).toBeInTheDocument();
  });

  it('fetches all four dashboard queries', async () => {
    renderPage();
    await screen.findByText(/Velkommen, K001!/);
    expect(mockSummary).toHaveBeenCalledTimes(1);
    expect(mockTimeSeries).toHaveBeenCalledWith({ groupBy: 'month' });
    expect(mockByVaregruppe).toHaveBeenCalledTimes(1);
    expect(mockGetAll).toHaveBeenCalledWith({ limit: 5, page: 1 });
  });

  it('renders KPI cards from the summary', async () => {
    renderPage();

    expect(await screen.findByText('Totale Ordrer')).toBeInTheDocument();
    expect(screen.getByText('Total Omsetning')).toBeInTheDocument();
    expect(screen.getByText('Produkter Bestilt')).toBeInTheDocument();
    expect(screen.getByText('Gjennomsnitt/Ordre')).toBeInTheDocument();

    // The recent-orders section lists fetched orders.
    expect(await screen.findByText('#10001')).toBeInTheDocument();
  });
});
