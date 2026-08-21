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
    return { items: parsed.items.filter((i) => i && typeof i.varekode === 'string'), kundenr };
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
  const isAdmin = user?.role === 'admin';

  const [state, dispatch] = useReducer(cartReducer, { ...emptyCart, kundenr });

  useEffect(() => {
    if (kundenr) {
      dispatch({ type: 'load', state: readStoredCart(kundenr) });
    } else if (!isAdmin) {
      dispatch({ type: 'load', state: { ...emptyCart, kundenr: null } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kundenr, isAdmin]);

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

  const value = useMemo(
    () => ({
      items: state.items,
      count: state.items.reduce((acc, i) => acc + i.antall, 0),
      total: Math.round(state.items.reduce((acc, i) => acc + i.unit_price * i.antall, 0) * 100) / 100,
      addItem,
      setQuantity: (varekode: string, antall: number) => dispatch({ type: 'setQuantity', varekode, antall }),
      removeItem: (varekode: string) => dispatch({ type: 'remove', varekode }),
      clear: () => dispatch({ type: 'clear' }),
    }),
    [state.items, addItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
