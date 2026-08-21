/**
 * Unit tests for auth middleware (authMiddleware & roleGuard)
 *
 * We mock jsonwebtoken to control token verification behaviour
 * without needing a real JWT_SECRET or actual signing.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, roleGuard, AuthRequest, invalidateTokenVersionCache } from '../auth';

jest.mock('jsonwebtoken');
jest.mock('../../models/userModel', () => ({
  userModel: {
    getTokenVersion: jest.fn().mockResolvedValue(0),
  },
}));

const { userModel } = jest.requireMock('../../models/userModel') as {
  userModel: { getTokenVersion: jest.Mock };
};
const mockVerify = jwt.verify as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────

function mockReqResNext(overrides: Partial<Request> = {}) {
  const req = {
    headers: {},
    ...overrides,
  } as AuthRequest;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;

  const next = jest.fn() as NextFunction;

  return { req, res, next };
}

// ── Tests ────────────────────────────────────────────────────────────

describe('authMiddleware', () => {
  beforeEach(() => {
    // resetAllMocks in afterEach clears implementations; restore the default
    userModel.getTokenVersion.mockReset();
    userModel.getTokenVersion.mockResolvedValue(0);
    invalidateTokenVersionCache();
  });
  afterEach(() => jest.resetAllMocks());

  it('returns 401 when no authorization header is present', async () => {
    const { req, res, next } = mockReqResNext();

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header does not start with Bearer', async () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Basic abc123' } as any,
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', async () => {
    mockVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer expired-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user on valid token', async () => {
    const decodedUser = {
      id: 1,
      username: 'admin',
      role: 'admin',
    };
    mockVerify.mockReturnValue(decodedUser);

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer valid-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(decodedUser);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('calls next() when kundenr is null (admin users without customer number)', async () => {
    mockVerify.mockReturnValue({
      id: 1,
      username: 'admin',
      role: 'admin',
      kundenr: null,
    });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer valid-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({ id: 1, username: 'admin', role: 'admin' });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 401 when token payload fails schema validation', async () => {
    mockVerify.mockReturnValue({ id: 1, username: 'x', role: 'superuser' });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer bad-payload' } as any,
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token payload' });
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects a token whose tokenVersion is behind the current DB version', async () => {
    userModel.getTokenVersion.mockResolvedValue(3);
    mockVerify.mockReturnValue({
      id: 1,
      username: 'admin',
      role: 'admin',
      tokenVersion: 2,
    });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer stale-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Token revoked, please sign in again',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts a token whose tokenVersion matches the DB', async () => {
    userModel.getTokenVersion.mockResolvedValue(3);
    mockVerify.mockReturnValue({
      id: 1,
      username: 'admin',
      role: 'admin',
      tokenVersion: 3,
    });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer fresh-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 1,
      username: 'admin',
      role: 'admin',
      tokenVersion: 3,
    });
  });

  it('returns 401 when the user no longer exists in the DB', async () => {
    userModel.getTokenVersion.mockResolvedValue(null);
    mockVerify.mockReturnValue({ id: 999, username: 'ghost', role: 'admin' });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer orphan-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('fails closed on transient DB errors (revocation cannot be verified)', async () => {
    userModel.getTokenVersion.mockRejectedValue(new Error('connection refused'));
    mockVerify.mockReturnValue({ id: 1, username: 'admin', role: 'admin' });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer valid-token' } as any,
    });

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ error: 'Service temporarily unavailable' });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });
});

describe('roleGuard', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns 401 when req.user is not set', () => {
    const { req, res, next } = mockReqResNext();
    const guard = roleGuard('admin');

    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is not in allowed list', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 2, username: 'kunde1', role: 'kunde', kundenr: 'K000001' };
    const guard = roleGuard('admin');

    guard(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Access denied' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user role is allowed', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 1, username: 'admin', role: 'admin' };
    const guard = roleGuard('admin', 'analyse');

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('accepts multiple allowed roles', () => {
    const { req, res, next } = mockReqResNext();
    req.user = { id: 3, username: 'analyst', role: 'analyse' };
    const guard = roleGuard('admin', 'analyse');

    guard(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});
