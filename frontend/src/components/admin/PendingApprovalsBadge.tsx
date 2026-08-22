import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../../lib/api';
import { NavCountBadge } from '../NavCountBadge';

/** Live count of orders awaiting approval, shown in the admin sidebar. */
export function PendingApprovalsBadge() {
  const { data } = useQuery({
    queryKey: ['admin', 'approvals-count', 'pending_approval'],
    queryFn: async () => {
      const response = await ordersApi.getAll({ workflowStatus: 'pending_approval', limit: 1 });
      return response.data?.pagination?.total ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  return <NavCountBadge count={data ?? 0} />;
}
