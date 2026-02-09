/**
 * Unit tests for pricingService
 *
 * We mock:
 *  - db/index (query)           – the raw SQL helper
 *  - models/pricingModel        – priceRuleModel.findApplicable
 *
 * This lets us test the pricing *logic* (discounts, fixed prices, formatting)
 * without touching a real database.
 */

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('../../db/index', () => ({
  query: jest.fn(),
}));

jest.mock('../../models/pricingModel', () => ({
  priceRuleModel: {
    findApplicable: jest.fn(),
  },
  priceListModel: {},
  customerGroupModel: {},
}));

import { pricingService } from '../pricingService';
import { query } from '../../db/index';
import { priceRuleModel } from '../../models/pricingModel';

const mockQuery = query as jest.MockedFunction<typeof query>;
const mockFindApplicable = priceRuleModel.findApplicable as jest.Mock;

// ── Helpers ──────────────────────────────────────────────────────────

/** Shorthand to make mockQuery resolve a rows array */
function mockCustomerGroup(groupId: number | null) {
  mockQuery.mockResolvedValueOnce({
    rows: groupId !== null ? [{ customer_group_id: groupId }] : [],
    rowCount: groupId !== null ? 1 : 0,
    command: 'SELECT',
    oid: 0,
    fields: [],
  } as any);
}

// ── Tests ────────────────────────────────────────────────────────────

describe('pricingService', () => {
  afterEach(() => jest.resetAllMocks());

  // ────────────────────────────────────────────────────────────────────
  // calculatePrice
  // ────────────────────────────────────────────────────────────────────
  describe('calculatePrice', () => {
    const baseInput = {
      varekode: 'V00001',
      varegruppe: 'Slanger',
      kundenr: 'K000001',
      quantity: 10,
      base_price: 100,
    };

    it('returns base price when no applicable rules exist', async () => {
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([]);

      const result = await pricingService.calculatePrice(baseInput);

      expect(result.original_price).toBe(1000);
      expect(result.final_price).toBe(1000);
      expect(result.unit_price).toBe(100);
      expect(result.discount_applied).toBe(false);
      expect(result.discount_percent).toBeNull();
      expect(result.discount_amount).toBe(0);
      expect(result.applied_rule_id).toBeNull();
    });

    it('applies a percentage discount correctly', async () => {
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([
        {
          id: 42,
          price_list_id: 1,
          varekode: 'V00001',
          varegruppe: null,
          kundenr: null,
          customer_group_id: null,
          min_quantity: 1,
          discount_percent: 20,
          fixed_price: null,
          price_list_name: 'Standard',
          list_priority: 10,
        },
      ]);

      const result = await pricingService.calculatePrice(baseInput);

      expect(result.discount_applied).toBe(true);
      expect(result.discount_percent).toBe(20);
      expect(result.unit_price).toBe(80); // 100 * 0.80
      expect(result.final_price).toBe(800); // 80 * 10
      expect(result.discount_amount).toBe(200);
      expect(result.applied_rule_id).toBe(42);
      expect(result.applied_list_name).toBe('Standard');
    });

    it('applies a fixed price override correctly', async () => {
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([
        {
          id: 99,
          price_list_id: 2,
          varekode: 'V00001',
          varegruppe: null,
          kundenr: 'K000001',
          customer_group_id: null,
          min_quantity: 1,
          discount_percent: null,
          fixed_price: 75,
          price_list_name: 'VIP',
          list_priority: 20,
        },
      ]);

      const result = await pricingService.calculatePrice(baseInput);

      expect(result.discount_applied).toBe(true);
      expect(result.unit_price).toBe(75);
      expect(result.final_price).toBe(750); // 75 * 10
      expect(result.discount_amount).toBe(250);
      // discount_percent should be calculated: ((100 - 75) / 100) * 100 = 25
      expect(result.discount_percent).toBe(25);
      expect(result.applied_rule_id).toBe(99);
    });

    it('uses only the first (best) rule when multiple rules match', async () => {
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([
        {
          id: 10,
          price_list_id: 1,
          varekode: 'V00001',
          varegruppe: null,
          kundenr: 'K000001',
          customer_group_id: null,
          min_quantity: 1,
          discount_percent: 30,
          fixed_price: null,
          price_list_name: 'Premium',
          list_priority: 100,
        },
        {
          id: 20,
          price_list_id: 2,
          varekode: 'V00001',
          varegruppe: null,
          kundenr: null,
          customer_group_id: null,
          min_quantity: 1,
          discount_percent: 10,
          fixed_price: null,
          price_list_name: 'Standard',
          list_priority: 1,
        },
      ]);

      const result = await pricingService.calculatePrice(baseInput);

      expect(result.applied_rule_id).toBe(10);
      expect(result.discount_percent).toBe(30);
    });

    it('handles customer with no group', async () => {
      mockCustomerGroup(null);
      mockFindApplicable.mockResolvedValueOnce([]);

      const result = await pricingService.calculatePrice(baseInput);

      // Should still resolve, passing null as customerGroupId
      expect(mockFindApplicable).toHaveBeenCalledWith(
        expect.objectContaining({ customerGroupId: null })
      );
      expect(result.discount_applied).toBe(false);
    });

    it('rounds final_price and discount_amount to 2 decimal places', async () => {
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([
        {
          id: 5,
          price_list_id: 1,
          varekode: 'V00001',
          varegruppe: null,
          kundenr: null,
          customer_group_id: null,
          min_quantity: 1,
          discount_percent: 33.33,
          fixed_price: null,
          price_list_name: 'Test',
          list_priority: 1,
        },
      ]);

      const result = await pricingService.calculatePrice({
        ...baseInput,
        quantity: 3,
        base_price: 99.99,
      });

      // Values should be rounded to 2 decimal places
      expect(Number.isFinite(result.final_price)).toBe(true);
      expect(result.final_price.toString().split('.')[1]?.length ?? 0).toBeLessThanOrEqual(2);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // formatRuleName
  // ────────────────────────────────────────────────────────────────────
  describe('formatRuleName', () => {
    it('formats a percentage discount rule', () => {
      const name = pricingService.formatRuleName({
        id: 1,
        price_list_id: 1,
        varekode: 'V00001',
        varegruppe: null,
        kundenr: null,
        customer_group_id: null,
        min_quantity: 1,
        discount_percent: 15,
        fixed_price: null,
        created_at: new Date(),
      });
      expect(name).toBe('15% rabatt på V00001');
    });

    it('formats a fixed price rule', () => {
      const name = pricingService.formatRuleName({
        id: 2,
        price_list_id: 1,
        varekode: null,
        varegruppe: 'Slanger',
        kundenr: null,
        customer_group_id: null,
        min_quantity: 1,
        discount_percent: null,
        fixed_price: 50,
        created_at: new Date(),
      });
      expect(name).toBe('Fast pris 50 på Slanger');
    });

    it('includes quantity threshold when min_quantity > 1', () => {
      const name = pricingService.formatRuleName({
        id: 3,
        price_list_id: 1,
        varekode: 'V00001',
        varegruppe: null,
        kundenr: null,
        customer_group_id: null,
        min_quantity: 10,
        discount_percent: 25,
        fixed_price: null,
        created_at: new Date(),
      });
      expect(name).toBe('25% rabatt på V00001 ved 10+ stk');
    });

    it('returns default name when rule has no discount or fixed price', () => {
      const name = pricingService.formatRuleName({
        id: 4,
        price_list_id: 1,
        varekode: null,
        varegruppe: null,
        kundenr: null,
        customer_group_id: null,
        min_quantity: 1,
        discount_percent: null,
        fixed_price: null,
        created_at: new Date(),
      });
      expect(name).toBe('Prisregel');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // calculatePricesForOrder
  // ────────────────────────────────────────────────────────────────────
  describe('calculatePricesForOrder', () => {
    it('calculates prices for multiple items', async () => {
      const items = [
        { varekode: 'V00001', varegruppe: 'Slanger', quantity: 5, base_price: 100 },
        { varekode: 'V00002', quantity: 2, base_price: 200 },
      ];

      // First item call
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([]);
      // Second item call
      mockCustomerGroup(1);
      mockFindApplicable.mockResolvedValueOnce([]);

      const results = await pricingService.calculatePricesForOrder(items, 'K000001');

      expect(results).toHaveLength(2);
      expect(results[0].original_price).toBe(500);
      expect(results[1].original_price).toBe(400);
    });
  });
});
