import { DataStatusWidgetProps } from '../../../../types/dashboard';
import { WidgetError } from './WidgetError';

export function DataStatusWidget({ data, isLoading, isError, onRetry }: DataStatusWidgetProps) {
  if (isError) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📊 Datastatus</h3>
        <WidgetError onRetry={onRetry} />
      </div>
    );
  }
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Ukjent';
    return new Date(dateStr).toLocaleDateString('nb-NO', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">📊 Datastatus</h3>
        <div className="animate-pulse space-y-3">
          <div className="h-16 bg-dark-700 rounded" />
          <div className="h-8 bg-dark-700 rounded" />
        </div>
      </div>
    );
  }

  const isFresh = data?.status === 'fresh';

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">📊 Datastatus</h3>
      
      {data ? (
        <div className="space-y-4">
          {/* Status indicator */}
          <div className={`p-4 rounded-lg ${isFresh ? 'bg-green-500/10 border border-green-500/30' : 'bg-amber-500/10 border border-amber-500/30'}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isFresh ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
              <div>
                <p className={`text-sm font-medium ${isFresh ? 'text-green-400' : 'text-amber-400'}`}>
                  {isFresh ? 'Data er oppdatert' : 'Data kan være utdatert'}
                </p>
                <p className="text-xs text-dark-400">{data.message}</p>
              </div>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-dark-800/50 rounded-lg">
              <span className="text-xs text-dark-400 block">Siste ordre</span>
              <span className="text-sm font-medium">{formatDate(data.dataFreshness.lastOrderDate)}</span>
            </div>
            <div className="p-3 bg-dark-800/50 rounded-lg">
              <span className="text-xs text-dark-400 block">Dager siden</span>
              <span className="text-sm font-medium">
                {data.dataFreshness.daysSinceLastOrder ?? 'N/A'} dager
              </span>
            </div>
            <div className="p-3 bg-dark-800/50 rounded-lg">
              <span className="text-xs text-dark-400 block">Kunder totalt</span>
              <span className="text-sm font-medium">{data.dataFreshness.totalCustomers.toLocaleString('nb-NO')}</span>
            </div>
            <div className="p-3 bg-dark-800/50 rounded-lg">
              <span className="text-xs text-dark-400 block">Produkter totalt</span>
              <span className="text-sm font-medium">{data.dataFreshness.totalProducts.toLocaleString('nb-NO')}</span>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-dark-400 text-center py-4">Kunne ikke hente datastatus</p>
      )}
    </div>
  );
}
