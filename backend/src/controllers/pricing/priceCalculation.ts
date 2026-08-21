import { Response } from 'express';
import { AuthRequest } from '../../middleware/auth.js';
import { pricingService } from '../../services/pricingService.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { assertKundeOwnership } from '../../lib/assertOwnership.js';
import { PriceCalculationInput } from '../../types/pricing.js';

/**
 * Pricing Controller - price calculation handlers
 */
export const priceCalculationHandlers = {
  // ============================================
  // PRICE CALCULATION
  // ============================================

  /**
   * POST /api/pricing/calculate
   * Calculate price for a product
   */
  calculatePrice: async (req: AuthRequest, res: Response) => {
    const data: PriceCalculationInput = req.body;

    if (!data.varekode || !data.kundenr || data.quantity === undefined || data.base_price === undefined) {
      throw new ValidationError('varekode, kundenr, quantity, and base_price are required');
    }

    const result = await pricingService.calculatePrice(data);
    res.json(result);
  },

  /**
   * POST /api/pricing/calculate/bulk
   * Calculate prices for multiple products
   */
  calculatePricesBulk: async (req: AuthRequest, res: Response) => {
    const { items, kundenr } = req.body;

    if (!items || !Array.isArray(items) || !kundenr) {
      throw new ValidationError('items array and kundenr are required');
    }

    const results = await pricingService.calculatePricesForOrder(items, kundenr);
    res.json(results);
  },

  /**
   * GET /api/pricing/customer/:kundenr/rules
   * Get all applicable rules for a customer
   */
  getCustomerRules: async (req: AuthRequest, res: Response) => {
    const { kundenr } = req.params;

    assertKundeOwnership(req.user, kundenr);

    const overview = await pricingService.getCustomerPricingOverview(kundenr);
    res.json(overview);
  }
};
