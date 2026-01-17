import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { pricingController } from '../controllers/pricingController.js';

export const pricingRouter = Router();

// ============================================
// CUSTOMER GROUPS
// ============================================

// Get all customer groups
pricingRouter.get('/groups', authMiddleware, pricingController.getGroups);

// Create a customer group
pricingRouter.post('/groups', authMiddleware, pricingController.createGroup);

// Update a customer group
pricingRouter.put('/groups/:id', authMiddleware, pricingController.updateGroup);

// Delete a customer group
pricingRouter.delete('/groups/:id', authMiddleware, pricingController.deleteGroup);

// Assign customer to group
pricingRouter.put('/groups/:id/customers/:kundenr', authMiddleware, pricingController.assignCustomerToGroup);

// Remove customer from group
pricingRouter.delete('/groups/customers/:kundenr', authMiddleware, pricingController.removeCustomerFromGroup);

// Get all customers with their groups
pricingRouter.get('/customers', authMiddleware, pricingController.getCustomersWithGroups);

// ============================================
// PRICE LISTS
// ============================================

// Get all price lists
pricingRouter.get('/lists', authMiddleware, pricingController.getLists);

// Get a single price list
pricingRouter.get('/lists/:id', authMiddleware, pricingController.getList);

// Create a price list
pricingRouter.post('/lists', authMiddleware, pricingController.createList);

// Update a price list
pricingRouter.put('/lists/:id', authMiddleware, pricingController.updateList);

// Delete a price list
pricingRouter.delete('/lists/:id', authMiddleware, pricingController.deleteList);

// ============================================
// PRICE RULES
// ============================================

// Get rules for a price list
pricingRouter.get('/lists/:id/rules', authMiddleware, pricingController.getRules);

// Get a single rule
pricingRouter.get('/rules/:id', authMiddleware, pricingController.getRule);

// Create a rule
pricingRouter.post('/rules', authMiddleware, pricingController.createRule);

// Update a rule
pricingRouter.put('/rules/:id', authMiddleware, pricingController.updateRule);

// Delete a rule
pricingRouter.delete('/rules/:id', authMiddleware, pricingController.deleteRule);

// ============================================
// PRICE CALCULATION
// ============================================

// Calculate price for a single item
pricingRouter.post('/calculate', authMiddleware, pricingController.calculatePrice);

// Calculate prices for multiple items (bulk)
pricingRouter.post('/calculate/bulk', authMiddleware, pricingController.calculatePricesBulk);

// Get applicable rules for a customer
pricingRouter.get('/customer/:kundenr/rules', authMiddleware, pricingController.getCustomerRules);
