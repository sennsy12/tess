import {
  applyBestRule,
  calculateMargin,
  calculateMarginPercent,
  formatRuleName,
} from '../pricingMath.js';
import type { PriceRule } from '../../types/pricing.js';

describe('pricingMath', () => {
  describe('calculateMargin', () => {
    it('returns price minus cost', () => {
      expect(calculateMargin(80, 100)).toBe(20);
    });
  });

  describe('calculateMarginPercent', () => {
    it('returns margin as percent of price', () => {
      expect(calculateMarginPercent(80, 100)).toBe(20);
    });

    it('returns 0 when price is 0', () => {
      expect(calculateMarginPercent(10, 0)).toBe(0);
    });
  });

  describe('applyBestRule', () => {
    const baseRule: PriceRule = {
      id: 1,
      price_list_id: 1,
      varekode: 'ABC',
      varegruppe: null,
      kundenr: null,
      customer_group_id: null,
      min_quantity: 1,
      discount_percent: 10,
      fixed_price: null,
      created_at: new Date(),
      price_list_name: 'Standard',
    };

    it('returns base price when no rules apply', () => {
      const result = applyBestRule(100, 2, []);
      expect(result.final_price).toBe(200);
      expect(result.discount_applied).toBe(false);
    });

    it('applies percentage discount from first rule', () => {
      const result = applyBestRule(100, 2, [baseRule]);
      expect(result.unit_price).toBe(90);
      expect(result.final_price).toBe(180);
      expect(result.discount_applied).toBe(true);
      expect(result.applied_rule_name).toBe(formatRuleName(baseRule));
    });

    it('applies fixed price override', () => {
      const result = applyBestRule(100, 1, [{ ...baseRule, discount_percent: null, fixed_price: 75 }]);
      expect(result.unit_price).toBe(75);
      expect(result.final_price).toBe(75);
    });
  });
});
