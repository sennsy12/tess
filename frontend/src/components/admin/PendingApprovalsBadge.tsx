import { usePendingApprovalCount } from '../../hooks/useApprovals';
import { NavCountBadge } from '../NavCountBadge';

/** Live count of orders awaiting approval, shown in the admin sidebar. */
export function PendingApprovalsBadge() {
  const { data } = usePendingApprovalCount();

  return <NavCountBadge count={data ?? 0} />;
}
