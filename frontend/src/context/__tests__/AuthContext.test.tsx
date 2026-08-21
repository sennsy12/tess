/**
 * Unit tests for AuthContext (AuthProvider + useAuth hook)
 *
 * Strategy:
 *  - Mock the `authApi` module so no HTTP calls are made.
 *  - Mock sessionStorage to observe auth persistence.
 *  - Render a tiny consumer component to exercise the hook.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../AuthContext.tsx';
import { useAuth } from '../useAuth';
import { vi, describe, beforeEach, it, expect } from 'vitest';
import { clearAuthToken } from '../../lib/auth/tokenStore';

// ── Mocks ────────────────────────────────────────────────────────────

vi.mock('../../lib/api', () => ({
  authApi: {
    login: vi.fn(),
    loginKunde: vi.fn(),
    verify: vi.fn(),
    refresh: vi.fn(),
    logout: vi.fn().mockResolvedValue({ data: { success: true } }),
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
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────

describe('AuthContext', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearAuthToken();
    vi.clearAllMocks();
    // verify should resolve by default (token still valid)
    mockVerify.mockResolvedValue({});
  });

  it('starts with null user and token when sessionStorage is empty', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(screen.getByTestId('token').textContent).toBe('null');
  });

  it('restores user and token from sessionStorage on mount', async () => {
    const storedUser = { id: 1, username: 'admin', role: 'admin' };
    sessionStorage.setItem('token', 'stored-jwt');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('loading').textContent).toBe('false');
    });

    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(storedUser);
    expect(screen.getByTestId('token').textContent).toBe('stored-jwt');
  });

  it('login() stores token, refresh token and user, updates context', async () => {
    const newUser = { id: 1, username: 'admin', role: 'admin' };
    mockLogin.mockResolvedValueOnce({
      data: { token: 'new-jwt', refreshToken: 'new-refresh', user: newUser },
    });

    renderWithProviders();
    const user = userEvent.setup();

    await user.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('new-jwt');
    });
    expect(JSON.parse(screen.getByTestId('user').textContent!)).toEqual(newUser);
    expect(sessionStorage.getItem('token')).toBe('new-jwt');
    expect(sessionStorage.getItem('refreshToken')).toBe('new-refresh');
    expect(sessionStorage.getItem('user')).toBe(JSON.stringify(newUser));
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

  it('logout() clears token, refresh token and user from context and sessionStorage', async () => {
    const storedUser = { id: 1, username: 'admin', role: 'admin' };
    sessionStorage.setItem('token', 'stored-jwt');
    sessionStorage.setItem('refreshToken', 'stored-refresh');
    sessionStorage.setItem('user', JSON.stringify(storedUser));

    renderWithProviders();
    const user = userEvent.setup();

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('user').textContent).not.toBe('null');
    });

    await user.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('token').textContent).toBe('null');
    });
    expect(screen.getByTestId('user').textContent).toBe('null');
    expect(sessionStorage.getItem('token')).toBeNull();
    expect(sessionStorage.getItem('refreshToken')).toBeNull();
    expect(sessionStorage.getItem('user')).toBeNull();
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
