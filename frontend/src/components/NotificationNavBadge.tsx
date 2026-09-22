import { useUnreadBadgeCount } from '../hooks/useNotifications';
import { NavCountBadge } from './NavCountBadge';

/** Live unread-count bubble for the Varsler nav entry (kunde + admin). */
export function NotificationNavBadge({
  badgeClassName = '',
}: {
  collapsed?: boolean;
  badgeClassName?: string;
}) {
  const count = useUnreadBadgeCount();
  return <NavCountBadge count={count} className={badgeClassName} />;
}
