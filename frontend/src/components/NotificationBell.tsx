import { Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '../hooks/useNotifications';
import { useAuth } from '../context/useAuth';
import {
  getOrderPathFromNotification,
  isNotificationClickable,
} from '../lib/notificationNavigation';
import type { AppNotification } from '../types/notification';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const diffMs = now - d.getTime();
  if (diffMs < 60_000) return 'Nå';
  if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)} min siden`;
  return d.toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
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
      className={`w-full text-left px-4 py-3 border-b border-dark-800/80 transition-colors group ${
        unread ? 'bg-primary-950/20 hover:bg-primary-950/30' : 'hover:bg-dark-800/50'
      } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-medium ${unread ? 'text-white' : 'text-dark-200'}`}>{item.title}</p>
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
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const handleActivate = (item: AppNotification) => {
    if (!item.read_at) {
      markRead.mutate([item.id]);
    }

    const path = getOrderPathFromNotification(item, user?.role);
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
      >
        <Bell className="h-5 w-5" aria-hidden />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-[420px] rounded-xl border border-dark-700 bg-dark-900 shadow-2xl z-50 flex flex-col overflow-hidden">
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
        </div>
      )}
    </div>
  );
}
