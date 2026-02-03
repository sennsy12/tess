import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { productController } from '../controllers/productController.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const productsRouter = Router();

// Get all products
productsRouter.get('/', authMiddleware, asyncHandler(productController.getAll));

// Get product groups
productsRouter.get('/groups', authMiddleware, asyncHandler(productController.getGroups));

// Get a single product
productsRouter.get('/:varekode', authMiddleware, asyncHandler(productController.getOne));
