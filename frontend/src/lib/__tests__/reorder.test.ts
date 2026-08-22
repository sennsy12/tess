import { describe, expect, it, vi } from 'vitest';
import { addOrderToCart, buildReorderItems } from '../reorder';
import type { OrderDetail } from '../../types/order';

const makeOrder = (lines: Partial<OrderDetail['lines'][number]>[]): Pick<OrderDetail, 'lines'> => ({
  lines: lines.map((line, index) => ({
    linjenr: index + 1,
    varekode: 'VARE-1',
    antall: 1,
    enhet: 'STK',
    nettpris: 100,
    linjesum: 100,
    linjestatus: 1,
    ...line,
  })),
});

describe('buildReorderItems', () => {
  it('maps order lines to catalog-shaped cart products', () => {
    const items = buildReorderItems(
      makeOrder([{ varekode: 'A-100', varenavn: 'Bolt M8', varegruppe: 'Festemidler', antall: 12, nettpris: 4.5 }]),
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toEqual({
      antall: 12,
      product: {
        varekode: 'A-100',
        varenavn: 'Bolt M8',
        varegruppe: 'Festemidler',
        base_price: 4.5,
        unit_price: 4.5,
        discount_applied: false,
        discount_percent: null,
        applied_rule_name: null,
      },
    });
  });

  it('drops lines without a varekode or with non-positive quantity', () => {
    const items = buildReorderItems(
      makeOrder([
        { varekode: '', antall: 5 },
        { varekode: 'B-2', antall: 0 },
        { varekode: 'B-3', antall: -3 },
        { varekode: 'B-4', antall: Number.NaN },
        { varekode: 'OK-1', antall: 2 },
      ]),
    );

    expect(items.map((i) => i.product.varekode)).toEqual(['OK-1']);
  });

  it('clamps quantities to the allowed range and rounds fractional values', () => {
    const items = buildReorderItems(
      makeOrder([
        { varekode: 'FRAC', antall: 2.6 },
        { varekode: 'HUGE', antall: 5_000_000 },
      ]),
    );

    expect(items.find((i) => i.product.varekode === 'FRAC')?.antall).toBe(3);
    expect(items.find((i) => i.product.varekode === 'HUGE')?.antall).toBe(1_000_000);
  });

  it('returns an empty list for orders without lines', () => {
    expect(buildReorderItems({ lines: [] })).toEqual([]);
    expect(buildReorderItems({ lines: undefined as unknown as OrderDetail['lines'] })).toEqual([]);
  });
});

describe('addOrderToCart', () => {
  it('adds every valid line to the cart and reports the result', () => {
    const addItem = vi.fn();
    const result = addOrderToCart(
      makeOrder([
        { varekode: 'A-1', antall: 3 },
        { varekode: 'A-2', antall: 7 },
      ]),
      addItem,
    );

    expect(result).toEqual({ added: 2, skipped: 0 });
    expect(addItem).toHaveBeenCalledTimes(2);
    expect(addItem).toHaveBeenNthCalledWith(1, expect.objectContaining({ varekode: 'A-1' }), 3);
    expect(addItem).toHaveBeenNthCalledWith(2, expect.objectContaining({ varekode: 'A-2' }), 7);
  });

  it('counts dropped lines as skipped', () => {
    const addItem = vi.fn();
    const result = addOrderToCart(
      makeOrder([
        { varekode: 'A-1', antall: 3 },
        { varekode: '', antall: 9 },
        { varekode: 'A-3', antall: 0 },
      ]),
      addItem,
    );

    expect(result).toEqual({ added: 1, skipped: 2 });
    expect(addItem).toHaveBeenCalledTimes(1);
  });
});
