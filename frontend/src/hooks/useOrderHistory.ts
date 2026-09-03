import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../lib/api/orders';
import { kundeKeys, orderKeys } from '../lib/queryKeys';
import type { OrderStatusHistoryEntry } from '../types/order';

/**
 * Workflow timeline for one order (who/when/from→to/comment).
 * Server enforces kunde scoping — foreign orders resolve to 404 and surface
 * as an error state, never as leaked data.
 */
export function useOrderHistory(scope: 'admin' | 'kunde', ordrenr: number | undefined) {
  const enabled = typeof ordrenr === 'number' && Number.isFinite(ordrenr);
  return useQuery({
    queryKey:
      scope === 'kunde' && typeof ordrenr === 'number'
        ? kundeKeys.orderHistory(ordrenr)
        : orderKeys.history(scope, ordrenr ?? 0),
    queryFn: async (): Promise<OrderStatusHistoryEntry[]> => {
      const response = await ordersApi.getHistory(ordrenr as number);
      return response.data?.data ?? [];
    },
    enabled,
    staleTime: 30_000,
  });
}
