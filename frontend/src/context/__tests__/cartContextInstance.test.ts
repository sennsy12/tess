import { describe, it, expect } from 'vitest';
import { cartReducer, CART_STORAGE_PREFIX, type CartState } from '../cartContextInstance';
import type { CatalogProduct } from '../../lib/api/catalog';

const product = (varekode: string, unit_price = 10): CatalogProduct => ({
  varekode,
  varenavn: `Produkt ${varekode}`,
  varegruppe: 'Gruppe A',
  base_price: 12,
  unit_price,
  discount_applied: true,
  discount_percent: 15,
  applied_rule_name: '15% rabatt',
});

const state = (items: CartState['items'], kundenr = 'K001'): CartState => ({ items, kundenr });

describe('cartReducer', () => {
  it('adds a new item', () => {
    const next = cartReducer(state([]), { type: 'add', product: product('V1'), antall: 2, maxLines: 200, maxQty: 1_000_000 });
    expect(next.items).toHaveLength(1);
    expect(next.items[0]).toMatchObject({ varekode: 'V1', antall: 2 });
  });

  it('merges quantity when adding an existing varekode and refreshes the price', () => {
    const withItem = cartReducer(state([]), { type: 'add', product: product('V1', 10), antall: 1, maxLines: 200, maxQty: 1_000_000 });
    const next = cartReducer(withItem, { type: 'add', product: product('V1', 8), antall: 3, maxLines: 200, maxQty: 1_000_000 });
    expect(next.items).toHaveLength(1);
    expect(next.items[0].antall).toBe(4);
    expect(next.items[0].unit_price).toBe(8);
  });

  it('caps quantity at maxQty', () => {
    const next = cartReducer(state([]), { type: 'add', product: product('V1'), antall: 5, maxLines: 200, maxQty: 3 });
    expect(next.items[0].antall).toBe(3);
  });

  it('refuses to exceed the line limit', () => {
    const full = state(Array.from({ length: 3 }, (_, i) => ({
      varekode: `V${i}`, varenavn: null, varegruppe: null, unit_price: 1, antall: 1,
    })), 'K001');
    const next = cartReducer(full, { type: 'add', product: product('NEW'), antall: 1, maxLines: 3, maxQty: 100 });
    expect(next.items).toHaveLength(3);
    expect(next.items.find((i) => i.varekode === 'NEW')).toBeUndefined();
  });

  it('setQuantity removes the item when set to zero or below', () => {
    const withItem = cartReducer(state([]), { type: 'add', product: product('V1'), antall: 2, maxLines: 200, maxQty: 100 });
    const next = cartReducer(withItem, { type: 'setQuantity', varekode: 'V1', antall: 0 });
    expect(next.items).toHaveLength(0);
  });

  it('remove and clear work independently of order', () => {
    let s = state([]);
    s = cartReducer(s, { type: 'add', product: product('V1'), antall: 1, maxLines: 200, maxQty: 100 });
    s = cartReducer(s, { type: 'add', product: product('V2'), antall: 1, maxLines: 200, maxQty: 100 });
    s = cartReducer(s, { type: 'remove', varekode: 'V1' });
    expect(s.items.map((i) => i.varekode)).toEqual(['V2']);
    s = cartReducer(s, { type: 'clear' });
    expect(s.items).toEqual([]);
  });

  it('load replaces the entire state (kundenr switch)', () => {
    const next = cartReducer(state([{
      varekode: 'OLD', varenavn: null, varegruppe: null, unit_price: 1, antall: 9,
    }], 'K001'), { type: 'load', state: { items: [], kundenr: 'K002' } });
    expect(next.kundenr).toBe('K002');
    expect(next.items).toEqual([]);
  });
});

describe('CART_STORAGE_PREFIX', () => {
  it('namespaces carts per kunde', () => {
    expect(CART_STORAGE_PREFIX.endsWith(':')).toBe(true);
    expect(`${CART_STORAGE_PREFIX}K001`).toBe('tess-cart:K001');
  });
});
