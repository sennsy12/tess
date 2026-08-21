import { customerGroupsHandlers } from './pricing/customerGroups.js';
import { priceListsHandlers } from './pricing/priceLists.js';
import { priceRulesHandlers } from './pricing/priceRules.js';
import { priceCalculationHandlers } from './pricing/priceCalculation.js';

/**
 * Pricing Controller
 * HTTP handlers for pricing system endpoints
 *
 * Split into single-responsibility domain modules under `pricing/`;
 * this file assembles them so the public API is unchanged.
 */
export const pricingController = {
  ...customerGroupsHandlers,
  ...priceListsHandlers,
  ...priceRulesHandlers,
  ...priceCalculationHandlers,
};
