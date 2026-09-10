import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { CartContext, cartReducer, emptyCart, CART_STORAGE_PREFIX, type CartState } from './cartContextInstance';
import { useAuth } from './useAuth';
import type { CatalogProduct } from '../lib/api/catalog';

const MAX_LINES = 200;
const MAX_QTY = 1_000_000;

function readStoredCart(kundenr: string): CartState {
  try {
    const raw = localStorage.getItem(CART_STORAGE_PREFIX + kundenr);
    if (!raw) return { ...emptyCart, kundenr };
    const parsed = JSON.parse(raw) as CartState;
    if (!Array.isArray(parsed.items)) return { ...emptyCart, kundenr };
    const clean = parsed.items.filter(
      (i) =>
        i &&
        typeof i.varekode === 'string' &&
        typeof i.antall === 'number' &&
        Number.isFinite(i.antall) &&
        i.antall > 0 &&
        typeof i.unit_price === 'number' &&
        Number.isFinite(i.unit_price) &&
        i.unit_price >= 0,
    );
    return { items: clean, kundenr };
  } catch {
    return { ...emptyCart, kundenr };
  }
}

/**
 * Cart provider for the customer ordering flow.
 * Carts are persisted per kundenr in localStorage and survive reloads;
 * switching to a different customer account swaps the active cart.
 */
export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const kundenr = user?.role === 'kunde' ? (user.kundenr ?? '') : '';

  const [state, dispatch] = useReducer(cartReducer, { ...emptyCart, kundenr });

  useEffect(() => {
    if (kundenr) {
      dispatch({ type: 'load', state: readStoredCart(kundenr) });
    } else {
      // Admin (kundenr='') or logged-out: never show the previous kunde's
      // items. Prior code skipped load for admins and leaked stale carts.
      dispatch({ type: 'load', state: { ...emptyCart, kundenr: null } });
    }
  }, [kundenr]);

  // Persist on every change
  useEffect(() => {
    if (!state.kundenr) return;
    try {
      localStorage.setItem(CART_STORAGE_PREFIX + state.kundenr, JSON.stringify(state));
    } catch {
      // Storage full/unavailable — cart stays in memory only
    }
  }, [state]);

  const addItem = useCallback(
    (product: CatalogProduct, antall = 1) =>
      dispatch({ type: 'add', product, antall, maxLines: MAX_LINES, maxQty: MAX_QTY }),
    [],
  );
  const setQuantity = useCallback(
    (varekode: string, antall: number) => dispatch({ type: 'setQuantity', varekode, antall }),
    [],
  );
  const removeItem = useCallback(
    (varekode: string) => dispatch({ type: 'remove', varekode }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: 'clear' }), []);

  const value = useMemo(
    () => ({
      items: state.items,
      count: state.items.reduce((acc, i) => acc + i.antall, 0),
      // Banner-first (no bulk reprice): cart totals are frontend unit_price*qty
      // snapshots and can go stale. Backend single-rounds the order total, so
      // it may differ by 1-2 øre from summed frontend lines. Totals math is
      // intentionally unchanged here — the UI labels prices as provisional
      // ("Foreløpig pris – re-prises ved bekreftelse") instead of re-pricing.
      total: Math.round(state.items.reduce((acc, i) => acc + i.unit_price * i.antall, 0) * 100) / 100,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [state.items, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
