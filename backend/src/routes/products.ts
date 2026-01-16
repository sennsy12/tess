import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { productController } from '../controllers/productController.js';

export const productsRouter = Router();

// Get all products
productsRouter.get('/', authMiddleware, productController.getAll);

// Get all product groups
productsRouter.get('/groups', authMiddleware, productController.getGroups);

// Get single product
productsRouter.get('/:varekode', authMiddleware, productController.getOne);
