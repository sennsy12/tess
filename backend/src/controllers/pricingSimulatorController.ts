/**
 * Pricing Simulator Controller
 *
 * HTTP handler for the pricing simulation ("What-If") endpoint.
 *
 * @module controllers/pricingSimulatorController
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.js';
import { pricingSimulatorService } from '../services/pricingSimulatorService.js';
import { ValidationError } from '../middleware/errorHandler.js';
import type { SimulationRequest } from '../types/simulation.js';

export const pricingSimulatorController = {
  /**
   * POST /api/pricing/simulate
   *
   * Run a What-If simulation for a proposed pricing rule change.
   * Returns before/after revenue comparison with per-customer
   * and per-product breakdowns.
   */
  simulate: async (req: AuthRequest, res: Response) => {
    const body: SimulationRequest = req.body;

    if (!body.proposed_rule) {
      throw new ValidationError('proposed_rule is required');
    }

    if (!body.proposed_rule.price_list_id) {
      throw new ValidationError('proposed_rule.price_list_id is required');
    }

    // Must have at least one pricing mechanism
    const { discount_percent, fixed_price } = body.proposed_rule;
    if (discount_percent == null && fixed_price == null) {
      throw new ValidationError(
        'proposed_rule must include either discount_percent or fixed_price',
      );
    }

    const result = await pricingSimulatorService.simulate(body);
    res.json(result);
  },
};
