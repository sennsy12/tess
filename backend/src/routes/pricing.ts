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
  calculateBulkSchema,
  updateGroupSchema,
  updatePriceListSchema,
  updatePriceRuleSchema,
  simulateSchema,
  pricingCustomerSearchSchema,
  idParamSchema,
  assignCustomerParamSchema,
  removeCustomerParamSchema,
  checkConflictsSchema,
} from '../middleware/validation.js';
import { searchLimiter } from '../middleware/rateLimit.js';

export const pricingRouter = Router();

const auth = authMiddleware;
const adminOnly = roleGuard('admin');
const readRoles = roleGuard('admin', 'analyse');
const readRolesWithKunde = roleGuard('admin', 'analyse', 'kunde');

// ============================================
// CUSTOMER GROUPS
// ============================================

pricingRouter.get('/groups', auth, readRoles, asyncHandler(pricingController.getGroups));
pricingRouter.post('/groups', auth, adminOnly, validate(createGroupSchema), asyncHandler(pricingController.createGroup));
pricingRouter.put(
  '/groups/:id',
  auth,
  adminOnly,
  validate(idParamSchema, 'params'),
  validate(updateGroupSchema),
  asyncHandler(pricingController.updateGroup),
);
pricingRouter.delete('/groups/:id', auth, adminOnly, validate(idParamSchema, 'params'), asyncHandler(pricingController.deleteGroup));
// Combined param schema preserves both :id and :kundenr (idParamSchema alone would strip kundenr).
pricingRouter.put(
  '/groups/:id/customers/:kundenr',
  auth,
  adminOnly,
  validate(assignCustomerParamSchema, 'params'),
  asyncHandler(pricingController.assignCustomerToGroup),
);
pricingRouter.delete(
  '/groups/customers/:kundenr',
  auth,
  adminOnly,
  validate(removeCustomerParamSchema, 'params'),
  asyncHandler(pricingController.removeCustomerFromGroup)
);
pricingRouter.get(
  '/customers/search',
  auth,
  readRoles,
  validate(pricingCustomerSearchSchema, 'query'),
  asyncHandler(pricingController.searchCustomers),
);
pricingRouter.get('/customers', auth, readRoles, asyncHandler(pricingController.getCustomersWithGroups));

// ============================================
// PRICE LISTS
// ============================================

pricingRouter.get('/lists', auth, readRoles, asyncHandler(pricingController.getLists));
pricingRouter.get('/lists/:id', auth, readRoles, validate(idParamSchema, 'params'), asyncHandler(pricingController.getList));
pricingRouter.post('/lists', auth, adminOnly, validate(createPriceListSchema), asyncHandler(pricingController.createList));
pricingRouter.put(
  '/lists/:id',
  auth,
  adminOnly,
  validate(idParamSchema, 'params'),
  validate(updatePriceListSchema),
  asyncHandler(pricingController.updateList),
);
pricingRouter.delete('/lists/:id', auth, adminOnly, validate(idParamSchema, 'params'), asyncHandler(pricingController.deleteList));

// ============================================
// PRICE RULES
// ============================================

pricingRouter.get('/lists/:id/rules', auth, readRoles, validate(idParamSchema, 'params'), asyncHandler(pricingController.getRules));
pricingRouter.post('/rules/check-conflicts', auth, adminOnly, validate(checkConflictsSchema), asyncHandler(pricingController.checkRuleConflicts));
pricingRouter.get('/rules/:id', auth, readRoles, validate(idParamSchema, 'params'), asyncHandler(pricingController.getRule));
pricingRouter.post('/rules', auth, adminOnly, validate(createPriceRuleSchema), asyncHandler(pricingController.createRule));
pricingRouter.put(
  '/rules/:id',
  auth,
  adminOnly,
  validate(idParamSchema, 'params'),
  validate(updatePriceRuleSchema),
  asyncHandler(pricingController.updateRule),
);
pricingRouter.delete('/rules/:id', auth, adminOnly, validate(idParamSchema, 'params'), asyncHandler(pricingController.deleteRule));

// ============================================
// PRICING SIMULATION
// ============================================

// searchLimiter reused for expensive simulation (60/min) — no aggressive
// custom limiter, to avoid breaking legit bulk/admin use.
pricingRouter.post('/simulate', auth, adminOnly, searchLimiter, validate(simulateSchema), asyncHandler(pricingSimulatorController.simulate));

// ============================================
// PRICE CALCULATION
// ============================================

pricingRouter.post('/calculate', auth, readRoles, validate(calculatePriceSchema), asyncHandler(pricingController.calculatePrice));
// Bulk: zod-validated (items max 200, reused calculatePriceSchema fields).
// Same ValidationError 400 format as single calculate via validate().
pricingRouter.post(
  '/calculate/bulk',
  auth,
  readRoles,
  searchLimiter,
  validate(calculateBulkSchema),
  asyncHandler(pricingController.calculatePricesBulk),
);
pricingRouter.get('/customer/:kundenr/rules', auth, readRolesWithKunde, asyncHandler(pricingController.getCustomerRules));
