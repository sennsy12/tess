import request from 'supertest';
import app from '../index';
import { __resetEntraConfigForTests } from '../lib/entra';

// Mock dependencies
jest.mock('../models/userModel', () => ({
  userModel: {
    findByUsername: jest.fn(),
    findByKundenr: jest.fn(),
    findById: jest.fn(),
    findByIdWithHash: jest.fn(),
    findByEntraOid: jest.fn(),
    getTokenVersion: jest.fn(),
    linkEntra: jest.fn(),
    unlinkEntra: jest.fn(),
  },
}));

jest.mock('../models/refreshTokenModel', () => ({
  REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  refreshTokenModel: {
    create: jest
      .fn()
      .mockResolvedValue({ token: 'mock-refresh-token', expiresAt: new Date() }),
    rotate: jest.fn(),
    revoke: jest.fn().mockResolvedValue(true),
    revokeAllForUser: jest.fn().mockResolvedValue(1),
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

jest.mock('../lib/entraVerify', () => {
  const actual = jest.requireActual('../lib/entraVerify');
  return { ...actual, verifyEntraIdToken: jest.fn() };
});

import { userModel } from '../models/userModel';
import { refreshTokenModel } from '../models/refreshTokenModel';
import jwt from 'jsonwebtoken';
import {
  verifyEntraIdToken,
  EntraVerificationError,
} from '../lib/entraVerify';

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const DEV_ACTION_KEY = 'dev-only-action-key-not-for-production';

function saveEnv(): Record<string, string | undefined> {
  return {
    ENABLE_ENTRA: process.env.ENABLE_ENTRA,
    ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID,
    ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID,
  };
}

describe('Entra ID hybrid auth', () => {
  let savedEnv: Record<string, string | undefined>;

  beforeEach(() => {
    savedEnv = saveEnv();
    jest.clearAllMocks();
    delete process.env.ENABLE_ENTRA;
    delete process.env.ENTRA_TENANT_ID;
    delete process.env.ENTRA_CLIENT_ID;
    __resetEntraConfigForTests();
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    __resetEntraConfigForTests();
  });

  function enableEntra(): void {
    process.env.ENABLE_ENTRA = 'true';
    process.env.ENTRA_TENANT_ID = TENANT_ID;
    process.env.ENTRA_CLIENT_ID = CLIENT_ID;
    __resetEntraConfigForTests();
  }

  function adminAuth(): void {
    (jwt.verify as jest.Mock).mockReturnValue({
      id: 1,
      username: 'admin',
      role: 'admin',
      tokenVersion: 0,
    });
    (userModel.getTokenVersion as jest.Mock).mockResolvedValue(0);
  }

  describe('GET /api/auth/entra/config', () => {
    it('reports disabled without secrets when Entra is off', async () => {
      const res = await request(app).get('/api/auth/entra/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enabled: false });
    });

    it('exposes only client and tenant IDs when enabled', async () => {
      enableEntra();
      const res = await request(app).get('/api/auth/entra/config');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ enabled: true, clientId: CLIENT_ID, tenantId: TENANT_ID });
    });
  });

  describe('POST /api/auth/entra', () => {
    it('returns 503 when Entra sign-in is not enabled', async () => {
      const res = await request(app)
        .post('/api/auth/entra')
        .send({ idToken: 'x'.repeat(200) });
      expect(res.status).toBe(503);
    });

    it('returns 400 when the ID token is missing', async () => {
      enableEntra();
      const res = await request(app).post('/api/auth/entra').send({});
      expect(res.status).toBe(400);
    });

    it('returns 401 for an untrusted Microsoft token', async () => {
      enableEntra();
      (verifyEntraIdToken as jest.Mock).mockRejectedValue(new EntraVerificationError());
      const res = await request(app)
        .post('/api/auth/entra')
        .send({ idToken: 'x'.repeat(200) });
      expect(res.status).toBe(401);
    });

    it('returns 403 when the Microsoft account is not linked (no JIT)', async () => {
      enableEntra();
      (verifyEntraIdToken as jest.Mock).mockResolvedValue({
        oid: 'unlinked-oid',
        tenantId: TENANT_ID,
        loginHint: 'new@contoso.no',
      });
      (userModel.findByEntraOid as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/auth/entra')
        .send({ idToken: 'x'.repeat(200) });
      expect(res.status).toBe(403);
      expect(refreshTokenModel.create).not.toHaveBeenCalled();
    });

    it('issues the local token pair for a linked user', async () => {
      enableEntra();
      (verifyEntraIdToken as jest.Mock).mockResolvedValue({
        oid: 'linked-oid',
        tenantId: TENANT_ID,
        loginHint: 'ada@contoso.no',
      });
      (userModel.findByEntraOid as jest.Mock).mockResolvedValue({
        id: 7,
        username: 'ada',
        password_hash: 'irrelevant',
        role: 'analyse',
        token_version: 3,
      });
      const res = await request(app)
        .post('/api/auth/entra')
        .send({ idToken: 'x'.repeat(200) });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token', 'mock-jwt-token');
      expect(res.body).toHaveProperty('refreshToken', 'mock-refresh-token');
      expect(res.body.user).toMatchObject({ id: 7, username: 'ada', role: 'analyse' });
      expect(userModel.findByEntraOid).toHaveBeenCalledWith('linked-oid');
      expect(refreshTokenModel.create).toHaveBeenCalledWith(7);
    });
  });

  describe('POST /api/users/:id/entra-link', () => {
    const linkedUser = {
      id: 7,
      username: 'ada',
      role: 'analyse',
      entra_oid: 'linked-oid',
      entra_upn: 'ada@contoso.no',
    };

    beforeEach(() => adminAuth());

    it('links a Microsoft account with a valid action key', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue({ id: 7, username: 'ada' });
      (userModel.findByEntraOid as jest.Mock).mockResolvedValue(null);
      (userModel.linkEntra as jest.Mock).mockResolvedValue(linkedUser);

      const res = await request(app)
        .post('/api/users/7/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({ entraOid: 'linked-oid', entraUpn: 'ada@contoso.no', actionKey: DEV_ACTION_KEY });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ entra_oid: 'linked-oid' });
      expect(userModel.linkEntra).toHaveBeenCalledWith(7, 'linked-oid', 'ada@contoso.no');
    });

    it('rejects linking without an action key (400) or with a wrong one (403)', async () => {
      const missing = await request(app)
        .post('/api/users/7/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({ entraOid: 'linked-oid' });
      expect(missing.status).toBe(400);

      const wrong = await request(app)
        .post('/api/users/7/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({ entraOid: 'linked-oid', actionKey: 'wrong-key' });
      expect(wrong.status).toBe(403);

      expect(userModel.linkEntra).not.toHaveBeenCalled();
    });

    it('rejects an account already linked to another user', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue({ id: 7, username: 'ada' });
      (userModel.findByEntraOid as jest.Mock).mockResolvedValue({ id: 9, username: 'other' });

      const res = await request(app)
        .post('/api/users/7/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({ entraOid: 'linked-oid', actionKey: DEV_ACTION_KEY });

      expect(res.status).toBe(400);
      expect(userModel.linkEntra).not.toHaveBeenCalled();
    });

    it('returns 404 for an unknown user', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue(null);
      const res = await request(app)
        .post('/api/users/999/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({ entraOid: 'linked-oid', actionKey: DEV_ACTION_KEY });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/users/:id/entra-link', () => {
    beforeEach(() => adminAuth());

    it('unlinks with a valid action key', async () => {
      (userModel.findById as jest.Mock).mockResolvedValue({ id: 7, username: 'ada' });
      (userModel.unlinkEntra as jest.Mock).mockResolvedValue({ id: 7, username: 'ada' });

      const res = await request(app)
        .delete('/api/users/7/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({ actionKey: DEV_ACTION_KEY });

      expect(res.status).toBe(200);
      expect(userModel.unlinkEntra).toHaveBeenCalledWith(7);
    });

    it('rejects unlinking without an action key', async () => {
      const res = await request(app)
        .delete('/api/users/7/entra-link')
        .set({ Authorization: 'Bearer test-token' })
        .send({});
      expect(res.status).toBe(400);
      expect(userModel.unlinkEntra).not.toHaveBeenCalled();
    });
  });
});
