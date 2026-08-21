import request from 'supertest';
import app from '../index';
import { group } from 'console';

// Mock dependencies
jest.mock('../models/userModel', () => ({
  userModel: {
    findByUsername: jest.fn(),
    findByKundenr: jest.fn(),
    findByIdWithHash: jest.fn(),
    getTokenVersion: jest.fn(),
    bumpTokenVersion: jest.fn().mockResolvedValue(1),
    update: jest.fn(),
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

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('new-hash'),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

import { userModel } from '../models/userModel';
import { refreshTokenModel } from '../models/refreshTokenModel';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should return 200 with token, refresh token and user on valid credentials', async () => {
      (userModel.findByUsername as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'admin',
        password_hash: 'hashedpassword',
        role: 'admin',
        token_version: 0,
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token', 'mock-jwt-token');
      expect(res.body).toHaveProperty('refreshToken', 'mock-refresh-token');
      expect(res.body.user).toHaveProperty('username', 'admin');
      expect(refreshTokenModel.create).toHaveBeenCalledWith(1);
    });

    it('should return 401 with invalid credentials', async () => {
      (userModel.findByUsername as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'admin',
        password_hash: 'hashedpassword',
        role: 'admin',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return 401 if user does not exist', async () => {
        (userModel.findByUsername as jest.Mock).mockResolvedValue(null);

        const res = await request(app)
          .post('/api/auth/login')
          .send({ username: 'nonexistent', password: 'password' });

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error', 'Invalid credentials');
      });
  });

  describe('POST /api/auth/refresh', () => {
    it('rotates the token and returns a new access token', async () => {
      (refreshTokenModel.rotate as jest.Mock).mockResolvedValue({
        token: 'new-refresh-token',
        expiresAt: new Date(Date.now() + 1000),
        userId: 1,
      });
      (userModel.findByIdWithHash as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'admin',
        password_hash: 'hashedpassword',
        role: 'admin',
        token_version: 2,
      });

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'a'.repeat(64) });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token', 'mock-jwt-token');
      expect(res.body).toHaveProperty('refreshToken', 'new-refresh-token');
      // New access token must carry the current token version
      const claims = (jwt.sign as jest.Mock).mock.calls[0][0];
      expect(claims).toMatchObject({ id: 1, tokenVersion: 2 });
    });

    it('returns 401 for an invalid/revoked refresh token', async () => {
      (refreshTokenModel.rotate as jest.Mock).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'b'.repeat(64) });

      expect(res.status).toBe(401);
    });

    it('returns 400 when refreshToken is missing', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('revokes the presented refresh token', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'c'.repeat(64) });

      expect(res.status).toBe(200);
      expect(refreshTokenModel.revoke).toHaveBeenCalledWith('c'.repeat(64));
    });
  });

  describe('POST /api/auth/change-password', () => {
    function authHeaders() {
      return { Authorization: 'Bearer test-token' };
    }

    beforeEach(() => {
      (jwt.verify as jest.Mock).mockReturnValue({
        id: 1,
        username: 'admin',
        role: 'admin',
        tokenVersion: 0,
      });
      (userModel.getTokenVersion as jest.Mock).mockResolvedValue(0);
      (userModel.findByIdWithHash as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'admin',
        password_hash: 'old-hash',
        role: 'admin',
        token_version: 0,
      });
      (bcrypt.compare as jest.Mock).mockImplementation(
        (plain: string, hash: string) => hash === 'old-hash' && plain === 'old-password'
      );
    });

    it('bumps token_version and revokes all refresh tokens on success', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(authHeaders())
        .send({ currentPassword: 'old-password', newPassword: 'brand-new-password' });

      expect(res.status).toBe(200);
      expect(userModel.bumpTokenVersion).toHaveBeenCalledWith(1);
      expect(refreshTokenModel.revokeAllForUser).toHaveBeenCalledWith(1);
    });

    it('returns 401 when the current password is wrong', async () => {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set(authHeaders())
        .send({ currentPassword: 'wrong', newPassword: 'brand-new-password' });

      expect(res.status).toBe(401);
      expect(userModel.bumpTokenVersion).not.toHaveBeenCalled();
      expect(refreshTokenModel.revokeAllForUser).not.toHaveBeenCalled();
    });
  });
});
