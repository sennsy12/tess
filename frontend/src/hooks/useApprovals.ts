import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../lib/api/orders';
import { approvalsKeys } from '../lib/queryKeys';

const APPROVAL_COUNT_REFRESH_MS = 60_000;
const APPROVAL_COUNT_STALE_MS = 30_000;

/**
 * Live count of orders currently in one workflow status.
 *
 * Mounted by the admin sidebar badge (`PendingApprovalsBadge`), the admin
 * dashboard action card and the approvals queue's tab strip. Because every
 * consumer uses the same `approvalsKeys.count(status)` query key, TanStack
 * Query deduplicates them into ONE request regardless of how many are alive
 * at the same time — previously the dashboard and the sidebar each fired an
 * identical `GET /orders?workflowStatus=pending_approval&limit=1`.
 */
export function useApprovalCount(status: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: approvalsKeys.count(status),
    queryFn: async () => {
      const response = await ordersApi.getAll({ workflowStatus: status, limit: 1 });
      return response.data?.pagination?.total ?? 0;
    },
    enabled: options?.enabled ?? true,
    refetchInterval: APPROVAL_COUNT_REFRESH_MS,
    staleTime: APPROVAL_COUNT_STALE_MS,
  });
}

/** Convenience for the status used by the sidebar badge and admin dashboard. */
export function usePendingApprovalCount(options?: { enabled?: boolean }) {
  return useApprovalCount('pending_approval', options);
}