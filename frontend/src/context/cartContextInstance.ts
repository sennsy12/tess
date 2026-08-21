import { createContext } from 'react';
import type { CatalogProduct } from '../lib/api/catalog';

export interface CartItem {
  varekode: string;
  varenavn: string | null;
  varegruppe: string | null;
  unit_price: number;
  antall: number;
}

export interface CartState {
  items: CartItem[];
  kundenr: string | null;
}

export interface CartContextValue {
  /** Items for the current kunde (empty when cart belongs to another customer). */
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: CatalogProduct, antall?: number) => void;
  setQuantity: (varekode: string, antall: number) => void;
  removeItem: (varekode: string) => void;
  clear: () => void;
}

export const CART_STORAGE_PREFIX = 'tess-cart:';

export const emptyCart: CartState = { items: [], kundenr: null };

export const CartContext = createContext<CartContextValue | undefined>(undefined);

/** Reducer logic kept pure and exported for unit testing. */
export function cartReducer(
  state: CartState,
  action:
    | { type: 'load'; state: CartState }
    | { type: 'add'; product: CatalogProduct; antall: number; maxLines: number; maxQty: number }
    | { type: 'setQuantity'; varekode: string; antall: number }
    | { type: 'remove'; varekode: string }
    | { type: 'clear' },
): CartState {
  switch (action.type) {
    case 'load':
      return action.state;
    case 'add': {
      if (state.items.length >= action.maxLines) return state;
      const existing = state.items.find((i) => i.varekode === action.product.varekode);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.varekode === action.product.varekode
              ? { ...i, antall: Math.min(i.antall + action.antall, action.maxQty), unit_price: action.product.unit_price }
              : i,
          ),
        };
      }
      return {
        ...state,
        items: [
          ...state.items,
          {
            varekode: action.product.varekode,
            varenavn: action.product.varenavn,
            varegruppe: action.product.varegruppe,
            unit_price: action.product.unit_price,
            antall: Math.min(action.antall, action.maxQty),
          },
        ],
      };
    }
    case 'setQuantity': {
      if (action.antall <= 0) {
        return { ...state, items: state.items.filter((i) => i.varekode !== action.varekode) };
      }
      return {
        ...state,
        items: state.items.map((i) =>
          i.varekode === action.varekode ? { ...i, antall: Math.min(action.antall, 1_000_000) } : i,
        ),
      };
    }
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.varekode !== action.varekode) };
    case 'clear':
      return { ...state, items: [] };
    default:
      return state;
  }
}
