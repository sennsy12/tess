/**
 * Unit tests for auth middleware (authMiddleware & roleGuard)
 *
 * We mock jsonwebtoken to control token verification behaviour
 * without needing a real JWT_SECRET or actual signing.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { authMiddleware, roleGuard, AuthRequest } from '../auth';

jest.mock('jsonwebtoken');
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
  afterEach(() => jest.resetAllMocks());

  it('returns 401 when no authorization header is present', () => {
    const { req, res, next } = mockReqResNext();

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header does not start with Bearer', () => {
    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Basic abc123' } as any,
    });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when token verification fails', () => {
    mockVerify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer expired-token' } as any,
    });

    authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() and attaches user on valid token', () => {
    const decodedUser = {
      id: 1,
      username: 'admin',
      role: 'admin',
    };
    mockVerify.mockReturnValue(decodedUser);

    const { req, res, next } = mockReqResNext({
      headers: { authorization: 'Bearer valid-token' } as any,
    });

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual(decodedUser);
    expect(res.status).not.toHaveBeenCalled();
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
