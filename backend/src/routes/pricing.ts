import { Router } from 'express';
import { authMiddleware, roleGuard } from '../middleware/auth.js';
import { pricingController } from '../controllers/pricingController.js';
import { pricingSimulatorController } from '../controllers/pricingSimulatorController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import {
  validate,
  createGroupSchema,
  createPriceListSchema,
  createPriceRuleSchema,
  calculatePriceSchema,
  simulateSchema,
} from '../middleware/validation.js';

export const pricingRouter = Router();

const auth = authMiddleware;
const adminOnly = roleGuard('admin');
const readRoles = roleGuard('admin', 'analyse');

// ============================================
// CUSTOMER GROUPS
// ============================================

pricingRouter.get('/groups', auth, readRoles, asyncHandler(pricingController.getGroups));
pricingRouter.post('/groups', auth, adminOnly, validate(createGroupSchema), asyncHandler(pricingController.createGroup));
pricingRouter.put('/groups/:id', auth, adminOnly, asyncHandler(pricingController.updateGroup));
pricingRouter.delete('/groups/:id', auth, adminOnly, asyncHandler(pricingController.deleteGroup));
pricingRouter.put('/groups/:id/customers/:kundenr', auth, adminOnly, asyncHandler(pricingController.assignCustomerToGroup));
pricingRouter.delete('/groups/customers/:kundenr', auth, adminOnly, asyncHandler(pricingController.removeCustomerFromGroup));
pricingRouter.get('/customers/search', auth, readRoles, asyncHandler(pricingController.searchCustomers));
pricingRouter.get('/customers', auth, readRoles, asyncHandler(pricingController.getCustomersWithGroups));

// ============================================
// PRICE LISTS
// ============================================

pricingRouter.get('/lists', auth, readRoles, asyncHandler(pricingController.getLists));
pricingRouter.get('/lists/:id', auth, readRoles, asyncHandler(pricingController.getList));
pricingRouter.post('/lists', auth, adminOnly, validate(createPriceListSchema), asyncHandler(pricingController.createList));
pricingRouter.put('/lists/:id', auth, adminOnly, asyncHandler(pricingController.updateList));
pricingRouter.delete('/lists/:id', auth, adminOnly, asyncHandler(pricingController.deleteList));

// ============================================
// PRICE RULES
// ============================================

pricingRouter.get('/lists/:id/rules', auth, readRoles, asyncHandler(pricingController.getRules));
pricingRouter.post('/rules/check-conflicts', auth, adminOnly, asyncHandler(pricingController.checkRuleConflicts));
pricingRouter.get('/rules/:id', auth, readRoles, asyncHandler(pricingController.getRule));
pricingRouter.post('/rules', auth, adminOnly, validate(createPriceRuleSchema), asyncHandler(pricingController.createRule));
pricingRouter.put('/rules/:id', auth, adminOnly, asyncHandler(pricingController.updateRule));
pricingRouter.delete('/rules/:id', auth, adminOnly, asyncHandler(pricingController.deleteRule));

// ============================================
// PRICING SIMULATION
// ============================================

pricingRouter.post('/simulate', auth, adminOnly, validate(simulateSchema), asyncHandler(pricingSimulatorController.simulate));

// ============================================
// PRICE CALCULATION
// ============================================

pricingRouter.post('/calculate', auth, readRoles, validate(calculatePriceSchema), asyncHandler(pricingController.calculatePrice));
pricingRouter.post('/calculate/bulk', auth, readRoles, asyncHandler(pricingController.calculatePricesBulk));
pricingRouter.get('/customer/:kundenr/rules', auth, readRoles, asyncHandler(pricingController.getCustomerRules));
