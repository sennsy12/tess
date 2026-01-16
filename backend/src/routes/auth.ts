import { Router } from 'express';
import { authController } from '../controllers/authController.js';

export const authRouter = Router();

// Login endpoint
authRouter.post('/login', authController.login);

// Login with kundenr (for kunde users)
authRouter.post('/login/kunde', authController.loginKunde);

// Verify token endpoint
authRouter.get('/verify', authController.verify);
