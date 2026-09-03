import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, ChevronRight, Volume2, VolumeX } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { Breadcrumb } from '../../components/Breadcrumb';
import { Pagination } from '../../components/admin';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { Spinner } from '../../components/Spinner';
import {
  useMarkAllNotificationsRead,
  useMarkNotificationsRead,
  useNotificationsPage,
  useUnreadNotificationCount,
} from '../../hooks/useNotifications';
import { useAuth } from '../../context/useAuth';
import {
  buildDeepLink,
  formatNotificationTitle,
  isNotificationClickable,
} from '../../lib/notificationNavigation';
import {
  NOTIFICATION_TYPE_FILTERS,
  notificationTypeLabel,
} from '../../lib/notificationTypes';
import {
  isNotificationSoundEnabled,
  setNotificationSoundEnabled,
} from '../../lib/notificationSound';
import { formatRelativeTimeNb } from '../../lib/formatters';
import type { AppNotification } from '../../types/notification';

const PAGE_SIZE = 20;

type ReadFilter = 'alle' | 'uleste';

function formatWhen(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 60_000) return 'Nå';
  return formatRelativeTimeNb(new Date(iso));
}

/** Full notification center — shared by kunde and admin (role-scoped by the API). */
export function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isKunde = user?.role === 'kunde';

  const [page, setPage] = useState(1);
  const [readFilter, setReadFilter] = useState<ReadFilter>('alle');
  const [typeFilter, setTypeFilter] = useState('');
  const [soundOn, setSoundOn] = useState(() => isNotificationSoundEnabled());

  const listQuery = useNotificationsPage({
    page,
    limit: PAGE_SIZE,
    unreadOnly: readFilter === 'uleste',
    type: typeFilter,
  });
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markRead = useMarkNotificationsRead();
  const markAllRead = useMarkAllNotificationsRead();

  const rows = listQuery.data?.data ?? [];
  const pagination = listQuery.data?.pagination;

  const switchReadFilter = (next: ReadFilter) => {
    setReadFilter(next);
    setPage(1);
  };

  const switchTypeFilter = (next: string) => {
    setTypeFilter(next);
    setPage(1);
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setNotificationSoundEnabled(next);
  };

  const handleActivate = (item: AppNotification) => {
    if (!item.read_at) {
      markRead.mutate([item.id]);
    }
    const path = buildDeepLink(item, user?.role);
    if (path) navigate(path);
  };

  return (
    <Layout title="Varsler">
      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: isKunde ? 'Hjem' : 'Dashboard', to: isKunde ? '/kunde' : '/admin' },
            { label: 'Varsler' },
          ]}
        />

        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary-400" aria-hidden />
              <h2 className="text-lg font-semibold text-white">Varsler</h2>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary-600 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadCount > 99 ? '99+' : unreadCount} uleste
                </span>
              )}
            </div>

            <div
              className="flex rounded-md border border-dark-700 overflow-hidden"
              role="group"
              aria-label="Filtrer etter lest-status"
            >
              {(
                [
                  { value: 'alle', label: 'Alle' },
                  { value: 'uleste', label: 'Uleste' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  aria-pressed={readFilter === opt.value}
                  onClick={() => switchReadFilter(opt.value)}
                  className={`px-3 py-2 text-sm transition-colors ${
                    readFilter === opt.value
                      ? 'bg-primary-600 text-white'
                      : 'bg-dark-900 text-dark-300 hover:bg-dark-800 hover:text-dark-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-sm text-dark-300">
              <span className="label">Type</span>
              <select
                aria-label="Filtrer etter varseltype"
                className="input min-w-[180px]"
                value={typeFilter}
                onChange={(e) => switchTypeFilter(e.target.value)}
              >
                {NOTIFICATION_TYPE_FILTERS.map((t) => (
                  <option key={t || 'all'} value={t}>
                    {t === '' ? 'Alle typer' : notificationTypeLabel(t)}
                  </option>
                ))}
              </select>
            </label>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                aria-label={soundOn ? 'Skru av varsellyd' : 'Skru på varsellyd'}
                title={soundOn ? 'Varsellyd på' : 'Varsellyd av'}
                className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
              >
                {soundOn ? (
                  <Volume2 className="h-4 w-4" aria-hidden />
                ) : (
                  <VolumeX className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending || unreadCount === 0}
                className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
              >
                <CheckCheck className="h-4 w-4" aria-hidden />
                Merk alle lest
              </button>
            </div>
          </div>
        </div>

        {listQuery.isLoading ? (
          <div className="card flex items-center justify-center p-10">
            <Spinner size="lg" className="text-primary-500" label="Laster varsler…" />
          </div>
        ) : listQuery.isError ? (
          <QueryErrorBanner
            message="Kunne ikke laste varsler"
            onRetry={() => listQuery.refetch()}
          />
        ) : rows.length === 0 ? (
          <div className="card p-10 text-center text-sm text-dark-400">
            {readFilter === 'uleste' ? 'Ingen uleste varsler — bra jobbet!' : 'Ingen varsler ennå'}
          </div>
        ) : (
          <div className="card p-0 overflow-hidden">
            <ul className="divide-y divide-dark-800">
              {rows.map((item) => {
                const unread = !item.read_at;
                const clickable = isNotificationClickable(item, user?.role);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => handleActivate(item)}
                      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors group ${
                        unread ? 'bg-primary-950/20 hover:bg-primary-950/30' : 'hover:bg-dark-800/50'
                      }`}
                    >
                      <span
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary-500"
                        aria-hidden
                        style={{ visibility: unread ? 'visible' : 'hidden' }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              unread
                                ? 'bg-primary-600/20 text-primary-300'
                                : 'bg-dark-700 text-dark-300'
                            }`}
                          >
                            {notificationTypeLabel(item.type)}
                          </span>
                          {unread && <span className="sr-only">Ulest: </span>}
                          <span
                            className={`truncate text-sm font-medium ${
                              unread ? 'text-white' : 'text-dark-200'
                            }`}
                          >
                            {formatNotificationTitle(item)}
                          </span>
                        </span>
                        <span className="mt-1 line-clamp-2 block text-xs text-dark-400">
                          {item.message}
                        </span>
                        <span className="mt-1 block text-[10px] text-dark-500">
                          {formatWhen(item.created_at)}
                          {clickable && (
                            <span className="text-primary-500/80 ml-2">· Åpne ordre</span>
                          )}
                        </span>
                      </span>
                      {clickable && (
                        <ChevronRight
                          className="mt-1 h-4 w-4 shrink-0 text-dark-500 group-hover:text-primary-400 group-hover:translate-x-0.5 transition-all"
                          aria-hidden
                        />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {pagination && pagination.totalPages > 1 && (
              <div className="border-t border-dark-700/50 p-4">
                <Pagination
                  pagination={{
                    page: pagination.page,
                    total: pagination.total,
                    limit: pagination.limit,
                    totalPages: pagination.totalPages,
                  }}
                  onPageChange={setPage}
                  variant="full"
                  itemLabel="varsler"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
