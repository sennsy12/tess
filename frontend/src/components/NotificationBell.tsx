import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { NavCountBadge } from './NavCountBadge';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../hooks/useNotifications';
import { useAuth } from '../context/useAuth';
import {
  buildDeepLink,
  formatNotificationTitle,
  isNotificationClickable,
} from '../lib/notificationNavigation';
import { formatRelativeTimeNb } from '../lib/formatters';
import type { AppNotification } from '../types/notification';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'Nå';
  return formatRelativeTimeNb(date);
}

function NotificationItem({
  item,
  clickable,
  onActivate,
}: {
  item: AppNotification;
  clickable: boolean;
  onActivate: () => void;
}) {
  const unread = !item.read_at;

  return (
    <button
      type="button"
      onClick={onActivate}
      className={`w-full text-left px-4 py-3 border-b border-dark-800/80 transition-colors group cursor-pointer ${
        unread ? 'bg-primary-950/20 hover:bg-primary-950/30' : 'hover:bg-dark-800/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${unread ? 'text-white' : 'text-dark-200'}`}>
          {unread && <span className="sr-only">Ulest: </span>}
          {formatNotificationTitle(item)}
        </p>
        <div className="flex items-center gap-1.5 shrink-0">
          {unread && <span className="h-2 w-2 rounded-full bg-primary-500" aria-hidden />}
          {clickable && (
            <ChevronRight
              className="h-4 w-4 text-dark-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all"
              aria-hidden
            />
          )}
        </div>
      </div>
      <p className="text-xs text-dark-400 mt-1 line-clamp-2">{item.message}</p>
      <p className="text-[10px] text-dark-500 mt-1">
        {formatWhen(item.created_at)}
        {clickable && <span className="text-primary-500/80 ml-2">· Åpne ordre</span>}
      </p>
    </button>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const { data: count = 0 } = useUnreadNotificationCount();
  const { data: notifications = [], isLoading } = useNotifications(15);
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleActivate = (item: AppNotification) => {
    if (!item.read_at) {
      markRead.mutate([item.id]);
    }

    const path = buildDeepLink(item, user?.role);
    if (path) {
      setOpen(false);
      navigate(path);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
        aria-label={`Varsler${count > 0 ? `, ${count} uleste` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" aria-hidden />
        <NavCountBadge count={count} size="sm" className="absolute -top-0.5 -right-0.5" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Varsler"
          className="absolute right-0 mt-2 w-80 max-h-[420px] rounded-xl border border-dark-700 bg-dark-900 shadow-2xl z-50 flex flex-col overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-800">
            <h3 className="text-sm font-semibold text-white">Varsler</h3>
            {count > 0 && (
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                Merk alle lest
              </button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {isLoading ? (
              <p className="px-4 py-6 text-sm text-dark-400 text-center">Laster…</p>
            ) : notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-dark-400 text-center">Ingen varsler</p>
            ) : (
              notifications.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  clickable={isNotificationClickable(item, user?.role)}
                  onActivate={() => handleActivate(item)}
                />
              ))
            )}
          </div>
          <div className="border-t border-dark-800">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                navigate(user?.role === 'kunde' ? '/kunde/varsler' : '/admin/varsler');
              }}
              className="w-full px-4 py-2.5 text-sm text-primary-400 hover:text-primary-300 hover:bg-dark-800/50 transition-colors text-center"
            >
              Se alle varsler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
