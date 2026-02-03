import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pricingController } from '../controllers/pricingController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, createGroupSchema, createPriceListSchema, createPriceRuleSchema, calculatePriceSchema } from '../middleware/validation.js';

export const pricingRouter = Router();

// ============================================
// CUSTOMER GROUPS
// ============================================

// Get all customer groups
pricingRouter.get('/groups', authMiddleware, asyncHandler(pricingController.getGroups));

// Create a customer group
pricingRouter.post('/groups', authMiddleware, validate(createGroupSchema), asyncHandler(pricingController.createGroup));

// Update a customer group
pricingRouter.put('/groups/:id', authMiddleware, asyncHandler(pricingController.updateGroup));

// Delete a customer group
pricingRouter.delete('/groups/:id', authMiddleware, asyncHandler(pricingController.deleteGroup));

// Assign customer to group
pricingRouter.put('/groups/:id/customers/:kundenr', authMiddleware, asyncHandler(pricingController.assignCustomerToGroup));

// Remove customer from group
pricingRouter.delete('/groups/customers/:kundenr', authMiddleware, asyncHandler(pricingController.removeCustomerFromGroup));

// Get all customers with their groups
pricingRouter.get('/customers', authMiddleware, asyncHandler(pricingController.getCustomersWithGroups));

// ============================================
// PRICE LISTS
// ============================================

// Get all price lists
pricingRouter.get('/lists', authMiddleware, asyncHandler(pricingController.getLists));

// Get a single price list
pricingRouter.get('/lists/:id', authMiddleware, asyncHandler(pricingController.getList));

// Create a price list
pricingRouter.post('/lists', authMiddleware, validate(createPriceListSchema), asyncHandler(pricingController.createList));

// Update a price list
pricingRouter.put('/lists/:id', authMiddleware, asyncHandler(pricingController.updateList));

// Delete a price list
pricingRouter.delete('/lists/:id', authMiddleware, asyncHandler(pricingController.deleteList));

// ============================================
// PRICE RULES
// ============================================

// Get rules for a price list
pricingRouter.get('/lists/:id/rules', authMiddleware, asyncHandler(pricingController.getRules));

// Get a single rule
pricingRouter.get('/rules/:id', authMiddleware, asyncHandler(pricingController.getRule));

// Create a rule
pricingRouter.post('/rules', authMiddleware, validate(createPriceRuleSchema), asyncHandler(pricingController.createRule));

// Update a rule
pricingRouter.put('/rules/:id', authMiddleware, asyncHandler(pricingController.updateRule));

// Delete a rule
pricingRouter.delete('/rules/:id', authMiddleware, asyncHandler(pricingController.deleteRule));

// ============================================
// PRICE CALCULATION
// ============================================

// Calculate price for a single item
pricingRouter.post('/calculate', authMiddleware, validate(calculatePriceSchema), asyncHandler(pricingController.calculatePrice));

// Calculate prices for multiple items (bulk)
pricingRouter.post('/calculate/bulk', authMiddleware, asyncHandler(pricingController.calculatePricesBulk));

// Get applicable rules for a customer
pricingRouter.get('/customer/:kundenr/rules', authMiddleware, asyncHandler(pricingController.getCustomerRules));

