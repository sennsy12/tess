import { useState } from 'react';
import { Minus, Plus, ShoppingCart, BadgePercent } from 'lucide-react';
import type { CatalogProduct } from '../../../../lib/api/catalog';
import { formatMoneyNok } from '../../../../lib/formatters';

const MAX_QUANTITY = 1_000_000;

interface ProductCardProps {
  product: CatalogProduct;
  /** Units of this product already in the cart. */
  inCart: number;
  onAdd: () => void;
}

/** A single product tile in the catalog grid, with quantity stepper. */
export function ProductCard({ product, inCart, onAdd }: ProductCardProps) {
  const [qty, setQty] = useState(1);
  const hasDiscount = product.discount_applied && product.discount_percent != null;

  return (
    <div className="card p-4 flex flex-col gap-3 relative">
      {inCart > 0 && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-primary-600/20 text-primary-300 text-xs font-semibold">
          {inCart} i kurv
        </span>
      )}
      <div>
        <span className="font-mono text-xs text-dark-400">{product.varekode}</span>
        <h4 className="font-semibold leading-snug line-clamp-2">
          {product.varenavn || product.varekode}
        </h4>
        {product.varegruppe && (
          <span className="inline-block mt-1 px-2 py-0.5 bg-primary-600/20 text-primary-300 rounded text-xs">
            {product.varegruppe}
          </span>
        )}
      </div>

      <div className="mt-auto">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-green-400">{formatMoneyNok(product.unit_price)}</span>
          {hasDiscount && (
            <>
              <span className="text-sm text-dark-500 line-through">{formatMoneyNok(product.base_price)}</span>
              <span
                className="flex items-center gap-1 px-1.5 py-0.5 bg-green-600/20 text-green-300 rounded text-xs font-medium"
                title={product.applied_rule_name ?? undefined}
              >
                <BadgePercent className="h-3 w-3" aria-hidden />-{product.discount_percent}%
              </span>
            </>
          )}
        </div>
        {hasDiscount && product.applied_rule_name && (
          <p className="text-xs text-dark-500 mt-0.5 truncate" title={product.applied_rule_name}>
            {product.applied_rule_name}
          </p>
        )}

        <div className="flex gap-2 mt-3">
          <div className="flex items-center rounded-lg border border-dark-700 overflow-hidden">
            <button
              type="button"
              className="px-2 py-2 text-dark-400 hover:text-white hover:bg-dark-800 disabled:opacity-40"
              disabled={qty <= 1}
              onClick={() => setQty((q) => q - 1)}
              aria-label="Reduser antall"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden />
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(MAX_QUANTITY, parseInt(e.target.value, 10) || 1)))}
              className="w-14 bg-transparent text-center text-sm focus:outline-none"
              aria-label={`Antall ${product.varekode}`}
            />
            <button
              type="button"
              className="px-2 py-2 text-dark-400 hover:text-white hover:bg-dark-800"
              onClick={() => setQty((q) => Math.min(MAX_QUANTITY, q + 1))}
              aria-label="Øk antall"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          <button type="button" className="btn-primary flex-1 flex items-center justify-center gap-1.5" onClick={onAdd}>
            <ShoppingCart className="h-4 w-4" aria-hidden />
            Legg i kurv
          </button>
        </div>
      </div>
    </div>
  );
}
