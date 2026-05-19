/**
 * RBAC route wiring tests — pricing mutations and audit require admin.
 */
import { roleGuard } from '../../middleware/auth.js';
import type { AuthRequest } from '../../middleware/auth.js';
import { Request, Response, NextFunction } from 'express';

function mockReqResNext(user?: AuthRequest['user']) {
  const req = { user } as AuthRequest;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  const next = jest.fn() as NextFunction;
  return { req, res, next };
}

describe('pricing RBAC guards', () => {
  const adminGuard = roleGuard('admin');
  const readGuard = roleGuard('admin', 'analyse');

  it('denies kunde from admin-only mutations', () => {
    const { req, res, next } = mockReqResNext({
      id: 1,
      username: 'k1',
      role: 'kunde',
      kundenr: 'K000001',
    });
    adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('allows analyse to read pricing', () => {
    const { req, res, next } = mockReqResNext({
      id: 2,
      username: 'analyst',
      role: 'analyse',
    });
    readGuard(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('denies kunde from audit (admin only)', () => {
    const auditGuard = roleGuard('admin');
    const { req, res, next } = mockReqResNext({
      id: 1,
      username: 'k1',
      role: 'kunde',
    });
    auditGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
