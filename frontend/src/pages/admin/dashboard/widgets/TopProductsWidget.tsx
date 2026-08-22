import { useMemo } from 'react';

import { TopProductsWidgetProps } from '../../../../types/dashboard';
import { formatCurrencyNok } from '../../../../lib/formatters';
import { topN } from '../../../../lib/chartUtils';
import { WidgetError } from './WidgetError';

export function TopProductsWidget({ data, isLoading, isError, onRetry }: TopProductsWidgetProps) {
  // Hooks must run before any conditional return (rules of hooks).
  const maxRevenue = useMemo(() => Math.max(...data.map(p => Number(p.total_revenue) || 0), 1), [data]);
  const topProducts = useMemo(
    () => topN(data, 10, (product) => Number(product.total_revenue) || 0),
    [data],
  );

  if (isError) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">🏆 Topp 10 Produkter</h3>
        <WidgetError onRetry={onRetry} />
      </div>
    );
  }
  const formatCurrency = formatCurrencyNok;

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">🏆 Topp 10 Produkter</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 bg-dark-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">🏆 Topp 10 Produkter</h3>
      <div className="space-y-3">
        {topProducts.map((product, index) => (
          <div key={product.varekode} className="flex items-center gap-3">
            <span className="text-sm font-bold text-dark-400 w-6">{index + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate" title={product.varenavn}>
                  {product.varenavn}
                </span>
                <span className="text-sm text-primary-400 font-medium ml-2">
                  {formatCurrency(Number(product.total_revenue))}
                </span>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-primary-600 to-primary-400 rounded-full transition-all duration-500"
                  style={{ width: `${(Number(product.total_revenue) / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {data.length === 0 && (
        <p className="text-dark-400 text-center py-4">Ingen produktdata tilgjengelig</p>
      )}
    </div>
  );
}
