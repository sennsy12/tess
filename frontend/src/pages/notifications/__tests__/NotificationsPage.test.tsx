/**
 * Smoke tests for the shared notification center page.
 *
 * API layer and Layout are mocked; routing/query providers are real.
 * Verifies rows render, the unread filter narrows the query, the type
 * filter passes through, and "mark all read" calls the endpoint.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationsPage } from '../NotificationsPage';

vi.mock('../../../lib/api/notifications', () => ({
  notificationsApi: {
    list: vi.fn(),
    unreadCount: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

vi.mock('../../../context/useAuth', () => ({
  useAuth: () => ({ user: { id: 7, role: 'kunde', username: 'K001', kundenr: 'K001' } }),
}));

vi.mock('../../../components/Layout', () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { notificationsApi } from '../../../lib/api/notifications';

const mockList = notificationsApi.list as ReturnType<typeof vi.fn>;
const mockUnreadCount = notificationsApi.unreadCount as ReturnType<typeof vi.fn>;
const mockMarkAllRead = notificationsApi.markAllRead as ReturnType<typeof vi.fn>;

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    type: 'order_status',
    title: 'Ordre #1001 oppdatert',
    message: 'Status endret til «Godkjent».',
    metadata: { ordrenr: 1001 },
    audience: 'kunde',
    kundenr: 'K001',
    created_at: new Date().toISOString(),
    read_at: null,
    ...overrides,
  };
}

function listResponse(items: unknown[]) {
  return {
    data: {
      data: items,
      pagination: { page: 1, limit: 20, total: items.length, totalPages: 1 },
    },
  } as never;
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/kunde/varsler']}>
        <NotificationsPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockList.mockResolvedValue(listResponse([makeItem({ id: 1 }), makeItem({ id: 2, title: 'Ny ordre' })]));
  mockUnreadCount.mockResolvedValue({ data: { count: 2 } } as never);
  mockMarkAllRead.mockResolvedValue({ data: { marked: 2 } } as never);
});

describe('NotificationsPage', () => {
  it('renders notification rows with type labels', async () => {
    renderPage();

    await screen.findByText('Ordre #1001 oppdatert');
    expect(screen.getByText('2 uleste')).toBeInTheDocument();
    expect(screen.getAllByText('Ordrestatus').length).toBeGreaterThanOrEqual(1);
    expect(mockList).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 20 }),
    );
  });

  it('narrows the query when switching to Uleste', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ordre #1001 oppdatert');
    mockList.mockClear();

    await user.click(screen.getByRole('button', { name: 'Uleste' }));

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ unreadOnly: true }));
    });
  });

  it('passes the selected type filter through', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ordre #1001 oppdatert');
    mockList.mockClear();

    await user.selectOptions(screen.getByLabelText('Filtrer etter varseltype'), 'etl_failed');

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(expect.objectContaining({ type: 'etl_failed' }));
    });
  });

  it('calls mark-all-read from the header action', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Ordre #1001 oppdatert');

    await user.click(screen.getByRole('button', { name: 'Merk alle lest' }));

    await waitFor(() => {
      expect(mockMarkAllRead).toHaveBeenCalled();
    });
  });

  it('shows the empty state when there are no unread items', async () => {
    const user = userEvent.setup();
    mockList.mockResolvedValue(listResponse([makeItem({ id: 1 })]));
    renderPage();

    await screen.findByText('Ordre #1001 oppdatert');
    mockList.mockResolvedValue(listResponse([]));

    await user.click(screen.getByRole('button', { name: 'Uleste' }));

    await screen.findByText('Ingen uleste varsler — bra jobbet!');
  });
});
