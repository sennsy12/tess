import { useMemo } from 'react';

interface TopCustomer {
  kundenr: string;
  kundenavn: string;
  order_count: number;
  total_revenue: number;
  last_order_date: string;
}

interface Props {
  data: TopCustomer[];
  isLoading?: boolean;
}

export function TopCustomersWidget({ data, isLoading }: Props) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(value);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const maxRevenue = useMemo(() => Math.max(...data.map(c => Number(c.total_revenue) || 0), 1), [data]);

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">👥 Topp 10 Kunder</h3>
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
      <h3 className="text-lg font-semibold mb-4">👥 Topp 10 Kunder</h3>
      <div className="space-y-3">
        {data.slice(0, 10).map((customer, index) => (
          <div key={customer.kundenr} className="flex items-center gap-3">
            <span className="text-sm font-bold text-dark-400 w-6">{index + 1}.</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="min-w-0">
                  <span className="text-sm font-medium truncate block" title={customer.kundenavn}>
                    {customer.kundenavn}
                  </span>
                  <span className="text-xs text-dark-400">
                    Sist ordre: {formatDate(customer.last_order_date)}
                  </span>
                </div>
                <div className="text-right ml-2">
                  <span className="text-sm text-green-400 font-medium">
                    {formatCurrency(Number(customer.total_revenue))}
                  </span>
                  <span className="text-xs text-dark-400 block">
                    {customer.order_count} ordrer
                  </span>
                </div>
              </div>
              <div className="h-2 bg-dark-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-green-600 to-green-400 rounded-full transition-all duration-500"
                  style={{ width: `${(Number(customer.total_revenue) / maxRevenue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      {data.length === 0 && (
        <p className="text-dark-400 text-center py-4">Ingen kundedata tilgjengelig</p>
      )}
    </div>
  );
}
