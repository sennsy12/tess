import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { Pagination } from '../../components/admin';
import { auditApi, usersApi } from '../../lib/api';
import { downloadCsv } from '../../lib/csv';
import type { AuditEntry } from '../../types/pricing';

// ────────────────────────────────────────────────────────────
// Labels
// ────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<string, { label: string; className: string }> = {
  CREATE: { label: 'Opprettet', className: 'bg-green-500/20 text-green-300 border-green-500/40' },
  UPDATE: { label: 'Endret', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  DELETE: { label: 'Slettet', className: 'bg-red-500/20 text-red-300 border-red-500/40' },
};

const ENTITY_LABELS: Record<string, string> = {
  customer_group: 'Kundegruppe',
  price_list: 'Prisliste',
  price_rule: 'Prisregel',
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Navn',
  description: 'Beskrivelse',
  varekode: 'Varekode',
  varegruppe: 'Varegruppe',
  kundenr: 'Kundenr',
  customer_group_id: 'Kundegruppe-ID',
  min_quantity: 'Min. antall',
  discount_percent: 'Rabatt (%)',
  fixed_price: 'Fast pris (NOK)',
  valid_from: 'Gyldig fra',
  valid_to: 'Gyldig til',
  priority: 'Prioritet',
  is_active: 'Aktiv',
  price_list_id: 'Prisliste-ID',
};

const SNAPSHOT_EXCLUDE = new Set([
  'id', 'created_at', 'updated_at',
  'price_list_name', 'customer_group_name', 'list_priority',
]);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(tom)';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nei';
  return String(value);
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('nb-NO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

function UpdateDetails({ changes }: { changes: Record<string, { old: unknown; new: unknown }> }) {
  return (
    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">Endringer</div>
      <div className="space-y-1">
        {Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
          <div key={field} className="flex items-start gap-2 text-sm">
            <span className="text-dark-400 min-w-[120px] flex-shrink-0">
              {FIELD_LABELS[field] || field}:
            </span>
            <span className="text-red-400 line-through">{formatValue(oldVal)}</span>
            <span className="text-dark-500">→</span>
            <span className="text-green-400">{formatValue(newVal)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DeleteDetails({ snapshot }: { snapshot: Record<string, unknown> }) {
  const fields = useMemo(
    () => Object.entries(snapshot).filter(([key]) => !SNAPSHOT_EXCLUDE.has(key)),
    [snapshot],
  );
  return (
    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">Slettet data</div>
      <div className="space-y-1">
        {fields.map(([field, value]) => (
          <div key={field} className="flex items-start gap-2 text-sm">
            <span className="text-dark-400 min-w-[120px] flex-shrink-0">
              {FIELD_LABELS[field] || field}:
            </span>
            <span className="text-dark-200">{formatValue(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────

const LIMIT = 25;

export function AdminAudit() {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const { data: usersRes } = useQuery({
    queryKey: ['admin', 'users', 'all'],
    queryFn: () => usersApi.getAll({ limit: 500 }),
  });

  const users = usersRes?.data?.data ?? [];

  const { data: auditRes, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'audit', page, filterType, filterAction, filterUser, startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: LIMIT };
      if (filterType) params.entity_type = filterType;
      if (filterAction) params.action = filterAction;
      if (filterUser) params.user_id = filterUser;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await auditApi.getAll(params);
      return res.data;
    },
  });

  const entries: AuditEntry[] = auditRes?.data ?? [];
  const total = auditRes?.pagination?.total ?? 0;
  const totalPages = Math.ceil(total / LIMIT);

  const toggleExpand = useCallback((id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const hasActiveFilters = Boolean(filterType || filterAction || filterUser || startDate || endDate);
  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste endringslogg.';

  const exportAuditCsv = useCallback(() => {
    const rows = entries.map((entry) => ({
      Tidspunkt: formatTimestamp(entry.timestamp),
      Handling: ACTION_LABELS[entry.action]?.label ?? entry.action,
      Entitet: ENTITY_LABELS[entry.entity_type] ?? entry.entity_type,
      Navn: entry.entity_name || `#${entry.entity_id}`,
      Bruker: entry.username,
    }));
    downloadCsv('endringslogg', rows);
  }, [entries]);

  const handleReset = useCallback(() => {
    setFilterType('');
    setFilterAction('');
    setFilterUser('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  }, []);

  const TYPE_OPTIONS = [
    { value: '', label: 'Alle typer' },
    { value: 'customer_group', label: 'Kundegrupper' },
    { value: 'price_list', label: 'Prislister' },
    { value: 'price_rule', label: 'Prisregler' },
  ];

  const ACTION_OPTIONS = [
    { value: '', label: 'Alle handlinger' },
    { value: 'CREATE', label: 'Opprettet' },
    { value: 'UPDATE', label: 'Endret' },
    { value: 'DELETE', label: 'Slettet' },
  ];

  return (
    <Layout title="Endringslogg">
      <div className="space-y-6">
        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="label">Entitet</label>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Handling</label>
              <select
                value={filterAction}
                onChange={(e) => {
                  setFilterAction(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Bruker</label>
              <select
                value={filterUser}
                onChange={(e) => {
                  setFilterUser(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              >
                <option value="">Alle brukere</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.username} {u.role ? `(${u.role})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fra dato</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="label">Til dato</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="input text-sm"
              />
            </div>
            <button type="button" onClick={handleReset} className="btn-secondary text-sm">
              Nullstill
            </button>
            <button
              type="button"
              onClick={exportAuditCsv}
              disabled={entries.length === 0}
              className="btn-secondary text-sm"
            >
              Eksporter CSV
            </button>
          </div>
          <p className="text-xs text-dark-500 mt-3">
            Viser endringslogg for prisstyring (kundegrupper, prislister, regler). Bruk filtre for å begrense resultatet.
          </p>
        </div>

        {isError && <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />}

        {/* Results */}
        {isLoading ? (
          <div className="card flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-500" />
          </div>
        ) : isError ? null : entries.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'Ingen oppføringer matcher filtrene' : 'Ingen endringslogg ennå'}
            description={
              hasActiveFilters
                ? 'Prøv å utvide datoperiode eller fjerne filtre.'
                : 'Endringer i prisstyring vises her når de skjer.'
            }
            action={
              hasActiveFilters ? (
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Nullstill filtre
                </button>
              ) : undefined
            }
          />
        ) : (
          <div className="card">
            <div className="space-y-2">
              {entries.map((entry) => {
                const actionInfo = ACTION_LABELS[entry.action] || {
                  label: entry.action,
                  className: 'bg-dark-700 text-dark-300',
                };
                const entityLabel = ENTITY_LABELS[entry.entity_type] || entry.entity_type;
                const isExpanded = expandedId === entry.id;
                const hasDetails =
                  (entry.changes && Object.keys(entry.changes).length > 0) ||
                  (entry.action === 'DELETE' && entry.metadata?.snapshot);

                return (
                  <div key={entry.id} className="rounded-lg border border-dark-700 overflow-hidden">
                    <div
                      className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                        hasDetails ? 'cursor-pointer hover:bg-dark-800/50' : ''
                      }`}
                      onClick={() => hasDetails && toggleExpand(entry.id)}
                    >
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border ${actionInfo.className}`}>
                        {actionInfo.label}
                      </span>
                      <span className="text-sm text-dark-300">{entityLabel}</span>
                      <span className="text-sm text-dark-100 font-medium">
                        {entry.entity_name || `#${entry.entity_id}`}
                      </span>
                      <span className="text-xs text-dark-500 ml-auto flex-shrink-0">
                        {entry.username} · {formatTimestamp(entry.timestamp)}
                      </span>
                      {hasDetails && (
                        <span className="text-dark-500 text-xs flex-shrink-0">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>
                    {isExpanded && entry.action === 'UPDATE' && entry.changes && (
                      <UpdateDetails changes={entry.changes} />
                    )}
                    {isExpanded && entry.action === 'DELETE' && entry.metadata?.snapshot && (
                      <DeleteDetails snapshot={entry.metadata.snapshot} />
                    )}
                  </div>
                );
              })}
            </div>
            <Pagination
              pagination={{ page, total, limit: LIMIT, totalPages }}
              onPageChange={setPage}
              variant="simple"
              className="mt-4 pt-4 border-t border-dark-700"
            />
          </div>
        )}
      </div>
    </Layout>
  );
}
