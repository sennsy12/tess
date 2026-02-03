interface PriceDeviation {
  kundenr: string;
  kundenavn: string;
  customer_group_name: string | null;
  rule_count: number;
  avg_discount: number;
  max_discount: number;
}

interface Props {
  data: PriceDeviation[];
  isLoading?: boolean;
}

export function PriceDeviationsWidget({ data, isLoading }: Props) {
  const formatPercent = (value: number) => `${Number(value).toFixed(1)}%`;

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">💰 Største Prisavvik</h3>
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-dark-700 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">💰 Største Prisavvik</h3>
      <p className="text-sm text-dark-400 mb-4">Kunder med høyest rabatter</p>
      
      {data.length > 0 ? (
        <div className="space-y-2">
          {data.slice(0, 10).map((customer) => (
            <div 
              key={customer.kundenr} 
              className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg hover:bg-dark-700/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium truncate block" title={customer.kundenavn}>
                  {customer.kundenavn}
                </span>
                <span className="text-xs text-dark-400">
                  {customer.customer_group_name || 'Ingen gruppe'} · {customer.rule_count} regler
                </span>
              </div>
              <div className="text-right ml-4">
                <span className="text-sm font-bold text-amber-400">
                  {formatPercent(customer.max_discount)}
                </span>
                <span className="text-xs text-dark-400 block">
                  snitt: {formatPercent(customer.avg_discount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-dark-400">Ingen aktive prisregler funnet</p>
          <p className="text-xs text-dark-500 mt-1">Opprett prisregler for å se avvik</p>
        </div>
      )}
    </div>
  );
}
