/**
 * End-to-end tests for the axios 401 → refresh → replay interceptor
 * (lib/api/client.ts) — the auth-critical path that silently recovers an
 * expired access token or logs the user out when refresh fails.
 *
 * Uses a fake axios adapter for both the `api` instance and the raw global
 * axios (used by performRefresh) so no real network is involved and every
 * request/replay/refresh is asserted directly.
 */
import axios from 'axios';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import api from '../client';
import { AUTH_TOKEN_KEY, REFRESH_TOKEN_KEY } from '../../auth/tokenStore';
import { onAuthUnauthorized } from '../../auth/authEvents';

// Route table shared by instance + global adapters.
type Handler = (config: InternalRequestConfig) => Promise<{ status: number; data?: unknown }>;
interface InternalRequestConfig {
  url?: string;
  method?: string;
  headers: Record<string, string | undefined>;
  _retry?: boolean;
}

let routes: Array<{ match: (c: InternalRequestConfig) => boolean; handler: Handler }>;

/** Instance requests carry baseURL separately; raw axios posts include "/api" in the URL. */
function normalizeUrl(url: string | undefined): string {
  return (url ?? '').replace(/^\/api(?=\/)/, '');
}

function installFakeAdapter() {
  const dispatch = async (config: InternalRequestConfig) => {
    const normalized: InternalRequestConfig = { ...config, url: normalizeUrl(config.url) };
    const route = routes.find((r) => r.match(normalized));
    if (!route) throw new Error(`No fake route for ${config.method} ${config.url}`);
    const response = await route.handler(normalized);
    return {
      data: response.data ?? {},
      status: response.status,
      statusText: String(response.status),
      headers: {},
      config,
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = async (config: any) => {
    const res = await dispatch(config);
    // Real adapters are responsible for settling per validateStatus — a 401
    // must REJECT so the response interceptor's error branch runs.
    if (!config.validateStatus || config.validateStatus(res.status)) {
      return res;
    }
    const err = new Error(`Request failed with status code ${res.status}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).isAxiosError = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).config = config;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (err as any).response = res;
    throw err;
  };
  api.defaults.adapter = adapter as never;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (axios.defaults as any).adapter = adapter;
}

const ok = <T>(data: T) => ({ status: 200, data });
const unauthorized = () => ({ status: 401 });

describe('api client 401-refresh interceptor', () => {
  beforeEach(() => {
    sessionStorage.clear();
    routes = [];
    installFakeAdapter();
    vi.clearAllMocks();
  });

  it('replays the original request with a fresh token after a successful refresh', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh');

    const requests: Array<{ url?: string; retry?: boolean; auth?: string }> = [];
    routes = [
      {
        match: (c) => c.url === '/auth/refresh',
        handler: async () => ({
          status: 200,
          data: { token: 'fresh-token', refreshToken: 'rotated-refresh' },
        }),
      },
      {
        match: (c) => c.url === '/orders',
        handler: async (c) => {
          requests.push({ url: c.url, retry: c._retry, auth: c.headers.Authorization });
          return c._retry ? ok({ items: [] }) : unauthorized();
        },
      },
    ];

    const result = await api.get('/orders');
    expect(result.data).toEqual({ items: [] });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatchObject({ retry: undefined, auth: 'Bearer expired-token' });
    expect(requests[1]).toMatchObject({ retry: true, auth: 'Bearer fresh-token' });

    // Rotated tokens are persisted for subsequent requests.
    expect(sessionStorage.getItem(AUTH_TOKEN_KEY)).toBe('fresh-token');
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('rotated-refresh');
  });

  it('single-flights the refresh across parallel 401s (one refresh, N replays)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh');

    let refreshCalls = 0;
    let orderAttempts = 0;
    routes = [
      {
        match: (c) => c.url === '/auth/refresh',
        handler: async () => {
          refreshCalls += 1;
          await new Promise((r) => setTimeout(r, 10)); // widen the race window
          return { status: 200, data: { token: 'fresh-token', refreshToken: 'rotated' } };
        },
      },
      {
        match: (c) => c.url === '/orders',
        handler: async (c) => {
          orderAttempts += 1;
          return c._retry ? ok({ n: orderAttempts }) : unauthorized();
        },
      },
    ];

    const [a, b, c] = await Promise.all([
      api.get('/orders'),
      api.get('/orders'),
      api.get('/orders'),
    ]);
    // All three initial requests 401 before any replay, so replays are
    // attempts 4–6 — but they share ONE refresh and each gets its own replay.
    expect([a.data.n, b.data.n, c.data.n]).toEqual([4, 5, 6]);
    expect(refreshCalls).toBe(1);
    expect(orderAttempts).toBe(6); // 3 initial 401s + 3 replays
  });

  it('emits exactly one unauthorized event and clears refresh token when refresh fails', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'dead-refresh');

    let events = 0;
    const off = onAuthUnauthorized(() => {
      events += 1;
    });

    routes = [
      { match: (c) => c.url === '/auth/refresh', handler: async () => unauthorized() },
      { match: (c) => c.url === '/orders', handler: async () => unauthorized() },
    ];

    await expect(api.get('/orders')).rejects.toMatchObject({ response: { status: 401 } });
    expect(events).toBe(1);
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();

    off();
  });

  it('does not attempt refresh for auth-route 401s (e.g. bad login credentials)', async () => {
    let refreshCalls = 0;
    routes = [
      {
        match: (c) => c.url === '/auth/refresh',
        handler: async () => {
          refreshCalls += 1;
          return { status: 200, data: {} };
        },
      },
      { match: (c) => c.url === '/auth/login', handler: async () => unauthorized() },
    ];

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refreshCalls).toBe(0);
  });

  it('never replays a replayed request (_retry guard)', async () => {
    sessionStorage.setItem(AUTH_TOKEN_KEY, 'expired-token');
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'valid-refresh');

    const attempts: Array<boolean | undefined> = [];
    routes = [
      {
        match: (c) => c.url === '/auth/refresh',
        handler: async () => ({
          status: 200,
          data: { token: 'still-invalid', refreshToken: 'rotated' },
        }),
      },
      {
        match: (c) => c.url === '/orders',
        handler: async (c) => {
          attempts.push(c._retry);
          return unauthorized(); // always 401 — even after replay
        },
      },
    ];

    await expect(api.get('/orders')).rejects.toMatchObject({ response: { status: 401 } });
    // Initial request + exactly ONE replay — then give up.
    expect(attempts).toHaveLength(2);
    expect(attempts[1]).toBe(true);
  });
});
