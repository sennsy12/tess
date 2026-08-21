/**
 * Catalog Service
 *
 * Customer-facing product catalog with per-customer effective prices.
 * Base prices come from `vare.base_price`; the pricing engine applies
 * the customer's best applicable rule on top of each base price.
 *
 * @module services/catalogService
 */
import { productModel } from '../models/productModel.js';
import { pricingService } from './pricingService.js';

export interface CatalogItem {
  varekode: string;
  varenavn: string | null;
  varegruppe: string | null;
  base_price: number;
  unit_price: number;
  discount_applied: boolean;
  discount_percent: number | null;
  applied_rule_name: string | null;
}

export const catalogService = {
  /**
   * List catalog products with the customer's effective unit price.
   * Pricing is computed for quantity 1 (display); order submission
   * re-prices with real quantities server-side.
   */
  listForCustomer: async (params: {
    search?: string;
    varegruppe?: string;
    page: number;
    limit: number;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    kundenr: string;
  }): Promise<{ data: CatalogItem[]; total: number }> => {
    const result = await productModel.searchProducts({
      search: params.search,
      varegruppe: params.varegruppe,
      page: params.page,
      limit: params.limit,
      sortBy: params.sortBy,
      sortDir: params.sortDir,
    });

    if (result.data.length === 0) {
      return { data: [], total: result.total };
    }

    const prices = await pricingService.calculatePricesForOrder(
      result.data.map((p) => ({
        varekode: p.varekode,
        varegruppe: p.varegruppe ?? undefined,
        quantity: 1,
        base_price: Number(p.base_price ?? 0),
      })),
      params.kundenr,
    );

    const priceByVarekode = new Map(prices.map((p, i) => [result.data[i].varekode, p]));

    const data: CatalogItem[] = result.data.map((p) => {
      const calc = priceByVarekode.get(p.varekode);
      return {
        varekode: p.varekode,
        varenavn: p.varenavn,
        varegruppe: p.varegruppe,
        base_price: Number(p.base_price ?? 0),
        unit_price: calc?.unit_price ?? Number(p.base_price ?? 0),
        discount_applied: calc?.discount_applied ?? false,
        discount_percent: calc?.discount_percent ?? null,
        applied_rule_name: calc?.applied_rule_name ?? null,
      };
    });

    return { data, total: result.total };
  },
};
