import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { productController } from '../controllers/productController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, productListQuerySchema, updateProductPriceSchema } from '../middleware/validation.js';

export const productsRouter = Router();

const listValidation = validate(productListQuerySchema, 'query');

productsRouter.get('/', authMiddleware, listValidation, asyncHandler(productController.list));
productsRouter.get('/search', authMiddleware, listValidation, asyncHandler(productController.list));

productsRouter.get('/groups', authMiddleware, asyncHandler(productController.getGroups));

// Set catalog base price (admin) — must be registered before /:varekode GET? No conflict, but keep explicit
productsRouter.patch(
  '/:varekode/price',
  authMiddleware,
  roleGuard('admin'),
  validate(updateProductPriceSchema),
  asyncHandler(productController.updateBasePrice),
);

productsRouter.get('/:varekode', authMiddleware, asyncHandler(productController.getOne));
