import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { productController } from '../controllers/productController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, productListQuerySchema } from '../middleware/validation.js';

export const productsRouter = Router();

const listValidation = validate(productListQuerySchema, 'query');

productsRouter.get('/', authMiddleware, listValidation, asyncHandler(productController.list));
productsRouter.get('/search', authMiddleware, listValidation, asyncHandler(productController.list));

productsRouter.get('/groups', authMiddleware, asyncHandler(productController.getGroups));

productsRouter.get('/:varekode', authMiddleware, asyncHandler(productController.getOne));
