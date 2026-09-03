/**
 * Smoke tests for samlet statuslinje på /admin/status.
 *
 * Verifiserer at stripen aggregerer statuskildene (OK vs varsel) og at
 * «Sist oppdatert» rendres. API-laget mockes; routing/query er ekte.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AdminStatus } from '../Status';

vi.mock('../../../lib/api', () => ({
  statusApi: {
    getStatus: vi.fn(),
    getImportStatus: vi.fn(),
    getExtractionStatus: vi.fn(),
    getHealth: vi.fn(),
    getApiMetrics: vi.fn(),
    getEtlMetrics: vi.fn(),
    getRecentActivity: vi.fn(),
  },
}));

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { statusApi } from '../../../lib/api';

const mockedApi = statusApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

function mockHealthy() {
  mockedApi.getStatus.mockResolvedValue({
    data: { status: 'healthy', database: { connected: true }, timestamp: new Date().toISOString() },
  } as never);
  mockedApi.getImportStatus.mockResolvedValue({ data: { status: 'ok' } } as never);
  mockedApi.getExtractionStatus.mockResolvedValue({ data: { status: 'ok' } } as never);
  mockedApi.getHealth.mockResolvedValue({ data: { status: 'healthy', backend: {} } } as never);
  mockedApi.getApiMetrics.mockResolvedValue({
    data: {
      summary: { status: 'ok', totalRequests: 10, totalSlowRequests: 0 },
      endpoints: [],
    },
  } as never);
  mockedApi.getEtlMetrics.mockResolvedValue({
    data: { summary: { totalRuns: 1, totalRejectedRows: 0 }, recentRuns: [] },
  } as never);
  mockedApi.getRecentActivity.mockResolvedValue({
    data: {
      dataFreshness: { lastOrderDate: '2026-08-01', daysSinceLastOrder: 1, totalCustomers: 5, totalProducts: 9 },
      status: 'fresh',
      message: 'Data is up to date (1 days old)',
    },
  } as never);
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchInterval: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/admin/status']}>
        <AdminStatus />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockHealthy();
});

describe('AdminStatus strip (smoke)', () => {
  it('viser OK + sist oppdatert når alt er sunt', async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Samlet systemstatus' })).toBeInTheDocument();
    });
    expect(screen.getByText('Alt fungerer normalt')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Sist oppdatert/)).toBeInTheDocument();
    });
  });

  it('varsler proporsjonalt ved trege API-kall uten å gå i feil', async () => {
    mockedApi.getApiMetrics.mockResolvedValue({
      data: {
        summary: { status: 'ok', totalRequests: 10, totalSlowRequests: 1 },
        endpoints: [],
      },
    } as never);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Varsel')).toBeInTheDocument();
    });
    expect(screen.getByText('API har registrert 1 tregt kall')).toBeInTheDocument();
  });
});
