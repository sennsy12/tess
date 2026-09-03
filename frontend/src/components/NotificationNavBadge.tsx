import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { NavCountBadge } from './NavCountBadge';

/** Live unread-count bubble for the Varsler nav entry (kunde + admin). */
export function NotificationNavBadge({
  badgeClassName = '',
}: {
  collapsed?: boolean;
  badgeClassName?: string;
}) {
  const { data } = useUnreadNotificationCount();
  return <NavCountBadge count={data ?? 0} className={badgeClassName} />;
}
