import type { CatalogProduct } from './api/catalog';
import type { OrderDetail } from '../types/order';

export const REORDER_MIN_QTY = 1;
export const REORDER_MAX_QTY = 1_000_000;

export interface ReorderItem {
  product: CatalogProduct;
  antall: number;
}

export interface ReorderResult {
  added: number;
  skipped: number;
}

const clampQuantity = (antall: number): number =>
  Math.min(REORDER_MAX_QTY, Math.max(REORDER_MIN_QTY, Math.round(antall)));

export function buildReorderItems(order: Pick<OrderDetail, 'lines'>): ReorderItem[] {
  return (order.lines ?? [])
    .filter((line) => typeof line.varekode === 'string' && line.varekode.trim().length > 0)
    .filter((line) => Number.isFinite(line.antall) && Math.round(line.antall) >= 1)
    .map<ReorderItem>((line) => ({
      antall: clampQuantity(line.antall),
      product: {
        varekode: line.varekode,
        varenavn: line.varenavn ?? null,
        varegruppe: line.varegruppe ?? null,
        base_price: line.nettpris,
        unit_price: line.nettpris,
        discount_applied: false,
        discount_percent: null,
        applied_rule_name: null,
      },
    }));
}

type CartAddItem = (product: CatalogProduct, antall?: number) => void;

export function addOrderToCart(
  order: Pick<OrderDetail, 'lines'>,
  addItem: CartAddItem,
): ReorderResult {
  const items = buildReorderItems(order);
  for (const item of items) {
    addItem(item.product, item.antall);
  }
  const totalLines = order.lines?.length ?? 0;
  return { added: items.length, skipped: Math.max(0, totalLines - items.length) };
}
