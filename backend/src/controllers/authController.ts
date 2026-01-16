import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/userModel.js';

export const authController = {
  login: async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required' });
      }

      const user = await userModel.findByUsername(username);

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);

      if (!isValidPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          kundenr: user.kundenr,
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          kundenr: user.kundenr,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  loginKunde: async (req: Request, res: Response) => {
    try {
      const { kundenr, password } = req.body;

      if (!kundenr || !password) {
        return res.status(400).json({ error: 'Kundenr and password are required' });
      }

      const user = await userModel.findByKundenr(kundenr);
      console.log('Customer login attempt for:', kundenr);

      if (!user) {
        console.log('Customer user not found for kundenr:', kundenr);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('Customer password valid:', isValidPassword);

      if (!isValidPassword) {
        console.log('Invalid password for customer:', kundenr);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate JWT
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          role: user.role,
          kundenr: user.kundenr,
        },
        process.env.JWT_SECRET || 'fallback-secret',
        { expiresIn: '24h' }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          kundenr: user.kundenr,
        },
      });
    } catch (error) {
      console.error('Kunde login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  },

  verify: async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ valid: false });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
      res.json({ valid: true, user: decoded });
    } catch (error) {
      res.status(401).json({ valid: false });
    }
  }
};
