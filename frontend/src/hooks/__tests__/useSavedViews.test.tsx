/**
 * Regression tests for `useSavedViews` shared-view caching.
 *
 * Shared views are server data owned by React Query: multiple panels on the
 * same page share ONE `/reports` request, saving/deleting invalidates the
 * cache instead of refetching synchronously, and non-admin roles never fire
 * the request at all.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSavedViews } from '../useSavedViews';

const authHolder: { user: { id: number; username: string; role: 'admin' | 'kunde' } | null } = {
  user: { id: 1, username: 'admin', role: 'admin' },
};

vi.mock('../../lib/api/reports', () => ({
  reportsApi: {
    getAll: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../context/useAuth', () => ({
  useAuth: () => authHolder,
}));

import { reportsApi } from '../../lib/api/reports';

const mockGetAll = reportsApi.getAll as ReturnType<typeof vi.fn>;
const mockSave = reportsApi.save as ReturnType<typeof vi.fn>;

function Panel({ scope }: { scope: string }) {
  const { views, saveView } = useSavedViews({
    scope,
    state: { metric: 'sum' as const },
    enabledShared: true,
  });
  return (
    <div>
      {views.map((view) => (
        <span key={view.id} data-testid="view">
          {view.name}
        </span>
      ))}
      <button type="button" onClick={() => void saveView('Delt visning', { isShared: true })}>
        save
      </button>
    </div>
  );
}

function renderPanels(count: number) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const panels = Array.from({ length: count }, (_, i) => (
    <Panel key={i} scope="admin-statistics" />
  ));
  return render(
    <QueryClientProvider client={queryClient}>
      <div>{panels}</div>
    </QueryClientProvider>,
  );
}

const sharedReport = {
  id: 1,
  name: 'Fellesanalyse',
  config: { __workspaceView: true, scope: 'admin-statistics', state: { metric: 'sum' } },
  created_at: '2026-01-01T00:00:00Z',
  username: 'admin',
};

describe('useSavedViews shared cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authHolder.user = { id: 1, username: 'admin', role: 'admin' };
    mockGetAll.mockResolvedValue({ data: { data: [sharedReport] } } as never);
    mockSave.mockResolvedValue({ data: {} } as never);
  });

  it('shares ONE /reports request across multiple panels', async () => {
    renderPanels(2);

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });
    // Both panels render the shared view from the same cached response.
    const views = await screen.findAllByTestId('view');
    expect(views).toHaveLength(2);
    expect(views.every((el) => el.textContent === 'Fellesanalyse')).toBe(true);
  });

  it('invalidates the cache after saving a shared view (refetches on demand)', async () => {
    const user = userEvent.setup();
    renderPanels(1);

    await waitFor(() => {
      expect(mockGetAll).toHaveBeenCalledTimes(1);
    });

    await user.click(screen.getByText('save'));
    await waitFor(() => {
      expect(mockSave).toHaveBeenCalledTimes(1);
      // Invalidation triggers a refetch of the active query.
      expect(mockGetAll).toHaveBeenCalledTimes(2);
    });
  });

  it('never fetches shared views for non-admin roles', async () => {
    authHolder.user = { id: 2, username: 'kunde1', role: 'kunde' };
    renderPanels(1);

    // Give any (wrong) request a chance to appear.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockGetAll).not.toHaveBeenCalled();
  });
});