import request from 'supertest';
import app from '../index';
import { group } from 'console';

// Mock dependencies
jest.mock('../models/userModel', () => ({
  userModel: {
    findByUsername: jest.fn(),
    findByKundenr: jest.fn(),
  },
}));

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn(),
}));

import { userModel } from '../models/userModel';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Auth Endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      (userModel.findByUsername as jest.Mock).mockResolvedValue({
        id: 1,
        username: 'admin',
        password_hash: 'hashedpassword',
        role: 'admin',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'admin', password: 'password' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('token', 'mock-jwt-token');
      expect(res.body.user).toHaveProperty('username', 'admin');
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
});
