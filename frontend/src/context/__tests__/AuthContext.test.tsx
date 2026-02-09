/**
 * Unit tests for AuthContext (AuthProvider + useAuth hook)
 *
 * Strategy:
 *  - Mock the `authApi` module so no HTTP calls are made.
 *  - Mock localStorage to observe token persistence.
 *  - Render a tiny consumer component to exercise the hook.
 */

import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../AuthContext';
import { vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  authApi: {
    login: vi.fn(),
    loginKunde: vi.fn(),
    verify: vi.fn(),
  },
}));

import { authApi } from '../../lib/api';

const mockLogin = authApi.login as ReturnType<typeof vi.fn>;
const mockLoginKunde = authApi.loginKunde as ReturnType<typeof vi.fn>;
const mockVerify = authApi.verify as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────

/** A minimal component that exposes AuthContext values for testing. */
function TestConsumer() {
  const { user, token, login, loginKunde, logout, isLoading } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="user">{user ? JSON.stringify(user) : 'null'}</div>
      <div data-testid="token">{token ?? 'null'}</div>
      <button onClick={() => login('admin', 'pass')}>Login</button>
      <button onClick={() => loginKunde('K000001', 'pass')}>LoginKunde</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  );
}

function renderWithProviders() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    // verify should resolve by default (token still valid)
    mockVerify.mockResolvedValue({});
  });

  it('starts with null user and token when localStorage is empty', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('restores user/token from localStorage on mount', async () => {
    const storedUser = { id: 1, username: 'admin', role: 'admin' };
    localStorage.setItem('token', 'stored-jwt');
    localStorage.setItem('user', JSON.stringify(storedUser));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('token').textContent).toBe('stored-jwt');
    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(storedUser);
  });

  it('login() stores token and user, updates context', async () => {
    const newUser = { id: 1, username: 'admin', role: 'admin' };
    mockLogin.mockResolvedValueOnce({
      data: { token: 'new-jwt', user: newUser },
    });

    renderWithProviders();
    const user = userEvent.setup();

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('new-jwt');
    });
    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(newUser);
    expect(localStorage.getItem('token')).toBe('new-jwt');
  });

  it('loginKunde() stores token and user, updates context', async () => {
    const newUser = { id: 2, username: 'K000001', role: 'kunde', kundenr: 'K000001' };
    mockLoginKunde.mockResolvedValueOnce({
      data: { token: 'kunde-jwt', user: newUser },
    });

    renderWithProviders();
    const user = userEvent.setup();

    await user.click(screen.getByText('LoginKunde'));

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('kunde-jwt');
    });
    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(newUser);
  });

  it('logout() clears token and user from context and localStorage', async () => {
    const storedUser = { id: 1, username: 'admin', role: 'admin' };
    localStorage.setItem('token', 'stored-jwt');
    localStorage.setItem('user', JSON.stringify(storedUser));

    renderWithProviders();
    const user = userEvent.setup();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('stored-jwt');
    });

    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('null');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('throws when useAuth is used outside AuthProvider', () => {
    // Suppress console.error for this expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    function Orphan() {
      useAuth();
      return null;
    }

    expect(() => render(<Orphan />)).toThrow(
      'useAuth must be used within an AuthProvider',
    );

    spy.mockRestore();
  });
});
