import bcrypt from 'bcrypt';
// Variables referenced inside jest.mock factories must be prefixed with
// "mock" (jest's out-of-scope allowlist).
import { query as mockDbQuery } from '../../__mocks__/db';

jest.mock('../../db/index', () => ({
  query: mockDbQuery,
}));
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('bootstrapped-hash'),
}));
jest.mock('../../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), fatal: jest.fn() },
}));

import { bootstrapDefaultAdmin } from '../../db/bootstrapAdmin';
import { logger } from '../../lib/logger';
import { __resetEnvCacheForTests } from '../../lib/env';

const mockQuery = mockDbQuery as jest.Mock;

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

function setEnv(overrides: Record<string, string | undefined> = {}): void {
  process.env.NODE_ENV = overrides.NODE_ENV ?? 'development';
  if (overrides.ADMIN_USERNAME === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = overrides.ADMIN_USERNAME;
  if (overrides.ADMIN_PASSWORD === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = overrides.ADMIN_PASSWORD;
  __resetEnvCacheForTests();
}

/** Production envs must satisfy validateEnv()'s other startup guards first. */
function setProdEnv(adminOverrides: { username?: string; password?: string } = {}): void {
  process.env.NODE_ENV = 'production';
  process.env.JWT_SECRET = 'p'.repeat(32);
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/tess';
  process.env.ADMIN_ACTION_KEY = 'a-sufficiently-long-action-key';
  process.env.FRONTEND_URL = 'https://tess.example.com';
  if (adminOverrides.username === undefined) delete process.env.ADMIN_USERNAME;
  else process.env.ADMIN_USERNAME = adminOverrides.username;
  if (adminOverrides.password === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = adminOverrides.password;
  __resetEnvCacheForTests();
}

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  delete process.env.ADMIN_USERNAME;
  delete process.env.ADMIN_PASSWORD;
  __resetEnvCacheForTests();
});

describe('bootstrapDefaultAdmin', () => {
  it('does nothing when an admin user already exists', async () => {
    setEnv();
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] });

    await bootstrapDefaultAdmin();

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('creates the default admin with dev fallback password in development', async () => {
    setEnv({ NODE_ENV: 'development' });
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await bootstrapDefaultAdmin();

    expect(bcrypt.hash).toHaveBeenCalledWith('admin123', 10);
    const [sql, params] = mockQuery.mock.calls[1];
    expect(sql).toContain(`INSERT INTO users`);
    expect(params[0]).toBe('admin');
    expect(params[1]).toBe('bootstrapped-hash');
    expect(logger.info).toHaveBeenCalled();
  });

  it('honours ADMIN_USERNAME and ADMIN_PASSWORD when provided', async () => {
    setEnv({ ADMIN_USERNAME: 'ops-lead', ADMIN_PASSWORD: 'correct-horse-battery' });
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await bootstrapDefaultAdmin();

    expect(bcrypt.hash).toHaveBeenCalledWith('correct-horse-battery', 10);
    expect(mockQuery.mock.calls[1][1][0]).toBe('ops-lead');
  });

  it('refuses to boot in production without ADMIN_PASSWORD', async () => {
    setProdEnv();
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(bootstrapDefaultAdmin()).rejects.toThrow(/ADMIN_PASSWORD is not set/);
    expect(bcrypt.hash).not.toHaveBeenCalled();
    // Only the existence check ran — nothing was inserted.
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('refuses short ADMIN_PASSWORD in production', async () => {
    setProdEnv({ password: 'short' });
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(bootstrapDefaultAdmin()).rejects.toThrow(/at least 12 characters/);
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  it('accepts a sufficiently long ADMIN_PASSWORD in production', async () => {
    setProdEnv({ password: 'long-enough-password' });
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await bootstrapDefaultAdmin();

    expect(bcrypt.hash).toHaveBeenCalledWith('long-enough-password', 10);
    expect(logger.info).toHaveBeenCalled();
  });
});
