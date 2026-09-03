import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';
import {
  useMarkNotificationsRead,
  useNotifications,
} from '../hooks/useNotifications';
import { useAuth } from '../context/useAuth';
import {
  buildDeepLink,
  formatNotificationTitle,
  isNotificationClickable,
} from '../lib/notificationNavigation';
import { detectNewNotifications } from '../lib/notificationTypes';
import {
  isNotificationSoundEnabled,
  playNotificationSound,
} from '../lib/notificationSound';
import type { AppNotification } from '../types/notification';

const MAX_TOASTS_PER_POLL = 3;
const TOAST_DURATION_MS = 6000;

/**
 * Global watcher mounted once in `Layout`.
 *
 * Reuses the bell's `useNotifications(15)` cache (no extra requests) and
 * raises a clickable toast + optional sound whenever *new* notification ids
 * arrive. Pre-existing items on first load never toast — the baseline is
 * captured silently.
 */
export function NotificationWatcher() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data } = useNotifications(15);
  const markRead = useMarkNotificationsRead();
  const seenRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (!data || !user) return;
    if (seenRef.current === null) {
      seenRef.current = new Set(data.map((n) => n.id));
      return;
    }

    const fresh = detectNewNotifications(seenRef.current, data);
    if (fresh.length === 0) return;
    for (const n of fresh) seenRef.current.add(n.id);

    if (isNotificationSoundEnabled()) {
      void playNotificationSound();
    }

    const openNotification = (n: AppNotification) => {
      if (!n.read_at) {
        markRead.mutate([n.id]);
      }
      const path = buildDeepLink(n, user.role);
      if (path) navigate(path);
    };

    for (const n of fresh.slice(0, MAX_TOASTS_PER_POLL)) {
      const clickable = isNotificationClickable(n, user.role);
      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              if (clickable) openNotification(n);
            }}
            className="flex w-full items-start gap-2.5 text-left"
          >
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-primary-400" aria-hidden />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-white">
                {formatNotificationTitle(n)}
              </span>
              <span className="mt-0.5 line-clamp-2 block text-xs text-dark-300">
                {n.message}
              </span>
              {clickable && (
                <span className="mt-1 block text-xs text-primary-400">Åpne ordre →</span>
              )}
            </span>
          </button>
        ),
        { duration: TOAST_DURATION_MS },
      );
    }

    if (fresh.length > MAX_TOASTS_PER_POLL) {
      toast.success(`+${fresh.length - MAX_TOASTS_PER_POLL} flere nye varsler`, {
        duration: TOAST_DURATION_MS,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- markRead is stable; data/user/navigate drive re-runs
  }, [data, user, navigate]);

  return null;
}
