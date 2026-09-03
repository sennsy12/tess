import { RefreshCw } from 'lucide-react';
import { useNow } from '../../hooks/useNow';
import { formatRelativeTimeNb } from '../../lib/formatters';
import type { SystemLevel } from '../../lib/aggregateSystemStatus';

interface SystemStatusStripProps {
  level: SystemLevel;
  reasons: string[];
  /** Eldste dataUpdatedAt av statuskildene – undefined ved initial/partial. */
  lastUpdated?: number;
  staleAfterMs?: number;
  isRefreshing: boolean;
  onRefresh: () => void;
}

const LEVEL_STYLE: Record<SystemLevel, { card: string; dot: string; badge: string; title: string }> = {
  ok: {
    card: 'border-green-700/50',
    dot: 'bg-green-500',
    badge: 'bg-green-600/20 text-green-400',
    title: 'Alt fungerer normalt',
  },
  warning: {
    card: 'border-amber-700/50',
    dot: 'bg-amber-500',
    badge: 'bg-amber-600/20 text-amber-400',
    title: 'Varsel',
  },
  error: {
    card: 'border-red-700/50',
    dot: 'bg-red-500',
    badge: 'bg-red-600/20 text-red-400',
    title: 'Feil oppdaget',
  },
  loading: {
    card: '',
    dot: 'bg-dark-600',
    badge: 'bg-dark-700/50 text-dark-400',
    title: 'Laster status …',
  },
};

const LEVEL_LABEL: Record<SystemLevel, string> = {
  ok: 'OK',
  warning: 'VARSEL',
  error: 'FEIL',
  loading: 'LASTER',
};

/**
 * Samlet statuslinje øverst på /admin/status. Fasit – detaljkortene under
 * er underordnet. Ikke sticky (bevisst: tydelig ved landing, stjeler ikke
 * viewport ved scroll).
 */
export function SystemStatusStrip({
  level,
  reasons,
  lastUpdated,
  staleAfterMs = 45_000,
  isRefreshing,
  onRefresh,
}: SystemStatusStripProps) {
  // Ticker for «for X s siden» og stale-pill – hopper over tick i skjult fane.
  const now = useNow(5_000);

  if (level === 'loading') {
    return (
      <div className="card animate-pulse" role="status" aria-label="Laster systemstatus">
        <div className="h-6 w-48 bg-dark-700/50 rounded mb-2" />
        <div className="h-4 w-64 bg-dark-700/40 rounded" />
      </div>
    );
  }

  const style = LEVEL_STYLE[level];
  const isStale = lastUpdated !== undefined && now - lastUpdated > staleAfterMs;
  const visibleReasons = reasons.slice(0, 2);
  const clock =
    lastUpdated !== undefined
      ? new Date(lastUpdated).toLocaleTimeString('nb-NO', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : null;

  return (
    <section className={`card ${style.card}`} role="status" aria-live="polite" aria-label="Samlet systemstatus">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-3 h-3 shrink-0 rounded-full ${style.dot}`} aria-hidden />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold">{style.title}</h2>
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.badge}`}>
                {LEVEL_LABEL[level]}
              </span>
              {isStale && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-600/20 text-amber-400">
                  Utdatert
                </span>
              )}
            </div>
            {visibleReasons.length > 0 && (
              <p className="text-sm text-dark-400 truncate" title={reasons.join(' · ')}>
                {visibleReasons.join(' · ')}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 sm:ml-auto shrink-0">
          <p className="text-xs text-dark-500 tabular-nums">
            {clock ? (
              <>
                Sist oppdatert {clock} · {formatRelativeTimeNb(new Date(lastUpdated as number))}
              </>
            ) : (
              'Venter på data …'
            )}
          </p>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="btn-secondary !px-3 !py-2 text-sm inline-flex items-center gap-1.5 whitespace-nowrap disabled:opacity-50"
            aria-label="Oppdater status nå"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden />
            Oppdater
          </button>
        </div>
      </div>
    </section>
  );
}
