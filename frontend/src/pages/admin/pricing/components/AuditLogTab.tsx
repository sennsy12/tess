import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pagination } from '../../../../components/admin';
import { auditApi } from '../../../../lib/api';
import { AuditEntry } from '../types';

// ────────────────────────────────────────────────────────────
// Label maps
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
  'id',
  'created_at',
  'updated_at',
  'price_list_name',
  'customer_group_name',
  'list_priority',
]);

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatValue(value: any): string {
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
// Filter options (extracted from JSX for clarity)
// ────────────────────────────────────────────────────────────

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

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

/** Expanded detail pane for UPDATE entries showing field diffs. */
function UpdateDetails({ changes }: { changes: Record<string, { old: any; new: any }> }) {
  return (
    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">
        Endringer
      </div>
      <div className="space-y-1">
        {Object.entries(changes).map(([field, { old: oldVal, new: newVal }]) => (
          <div key={field} className="flex items-start gap-2 text-sm">
            <span className="text-dark-400 min-w-[120px] flex-shrink-0">
              {FIELD_LABELS[field] || field}:
            </span>
            <span className="text-red-400 line-through">{formatValue(oldVal)}</span>
            <span className="text-dark-500">&rarr;</span>
            <span className="text-green-400">{formatValue(newVal)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Expanded detail pane for DELETE entries showing the snapshot. */
function DeleteDetails({ snapshot }: { snapshot: Record<string, any> }) {
  const fields = useMemo(
    () => Object.entries(snapshot).filter(([key]) => !SNAPSHOT_EXCLUDE.has(key)),
    [snapshot],
  );

  return (
    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">
        Slettet data
      </div>
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

export function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');

  // ── Data loading ──────────────────────────────────────
  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { page, limit: LIMIT };
      if (filterType) params.entity_type = filterType;
      if (filterAction) params.action = filterAction;
      const res = await auditApi.getAll(params);
      setEntries(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (error: any) {
      console.error('Failed to load audit log:', error);
      if (error.response?.status === 403) setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, filterType, filterAction]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  // ── Filter handlers ───────────────────────────────────
  const handleTypeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterType(e.target.value);
    setPage(1);
  }, []);

  const handleActionChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterAction(e.target.value);
    setPage(1);
  }, []);

  const toggleExpand = useCallback(
    (id: number) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  // ── Render ────────────────────────────────────────────
  return (
    <div className="card">
      {/* Header + filters */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold">Endringslogg</h3>
        <div className="flex gap-2">
          <select value={filterType} onChange={handleTypeChange} className="input text-sm">
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select
            value={filterAction}
            onChange={handleActionChange}
            className="input text-sm"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading / empty / content */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-dark-400">
          Ingen endringslogg-oppforinger funnet.
        </div>
      ) : (
        <>
          {/* Entry list */}
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
                <div
                  key={entry.id}
                  className="rounded-lg border border-dark-700 overflow-hidden"
                >
                  {/* Row */}
                  <div
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                      hasDetails ? 'cursor-pointer hover:bg-dark-800/50' : ''
                    }`}
                    onClick={() => hasDetails && toggleExpand(entry.id)}
                  >
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded border ${actionInfo.className}`}
                    >
                      {actionInfo.label}
                    </span>
                    <span className="text-sm text-dark-300">{entityLabel}</span>
                    <span className="text-sm text-dark-100 font-medium">
                      {entry.entity_name || `#${entry.entity_id}`}
                    </span>
                    <span className="text-xs text-dark-500 ml-auto flex-shrink-0">
                      {entry.username} &middot; {formatTimestamp(entry.timestamp)}
                    </span>
                    {hasDetails && (
                      <span className="text-dark-500 text-xs flex-shrink-0">
                        {isExpanded ? '\u25B2' : '\u25BC'}
                      </span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && entry.action === 'UPDATE' && entry.changes && (
                    <UpdateDetails changes={entry.changes} />
                  )}
                  {isExpanded &&
                    entry.action === 'DELETE' &&
                    entry.metadata?.snapshot && (
                      <DeleteDetails snapshot={entry.metadata.snapshot} />
                    )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <Pagination
            pagination={{ page, total, limit: LIMIT }}
            onPageChange={setPage}
            variant="simple"
            className="mt-4 pt-4 border-t border-dark-700"
          />
        </>
      )}
    </div>
  );
}
