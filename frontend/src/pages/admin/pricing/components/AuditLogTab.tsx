import { useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pagination } from '../../../../components/admin';
import { Spinner } from '../../../../components/Spinner';
import { auditApi } from '../../../../lib/api';
import { formatMoneyNok } from '../../../../lib/formatters';
import { pricingKeys } from '../../../../lib/queryKeys';
import { AuditEntry } from '../../../../types/pricing';

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
  customer_group_member: 'Gruppemedlem',
  price_list: 'Prisliste',
  price_rule: 'Prisregel',
  vare: 'Vare',
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
  base_price: 'Basispris (NOK)',
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

function formatValue(value: any, field?: string): string {
  if (value === null || value === undefined) return '(tom)';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nei';
  if (field === 'base_price') {
    const num = typeof value === 'number' ? value : Number(value);
    if (Number.isFinite(num)) {
      try {
        return formatMoneyNok(num);
      } catch {
        // fall through to plain formatting
      }
    }
  }
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
  { value: 'customer_group_member', label: 'Gruppemedlem' },
  { value: 'price_list', label: 'Prislister' },
  { value: 'price_rule', label: 'Prisregler' },
  { value: 'vare', label: 'Vare' },
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
            <span className="text-red-400 line-through">{formatValue(oldVal, field)}</span>
            <span className="text-dark-500">&rarr;</span>
            <span className="text-green-400">{formatValue(newVal, field)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Safely extract assign/remove details for customer_group_member audits.
 * Backend stores UPDATE with only newData (no old) so `changes` is null and
 * `metadata` may hold newData/snapshot/direct fields (or a top-level newData
 * if the API ever returns it). Always returns null instead of crashing. */
function getMemberDetails(entry: AuditEntry): Record<string, any> | null {
  try {
    const meta = entry?.metadata as Record<string, any> | null | undefined;
    if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
      const nested = (meta as Record<string, any>).newData;
      if (nested && typeof nested === 'object' && !Array.isArray(nested) && Object.keys(nested).length > 0) {
        return nested as Record<string, any>;
      }
      const snap = (meta as Record<string, any>).snapshot;
      if (
        entry?.entity_type === 'customer_group_member' &&
        snap &&
        typeof snap === 'object' &&
        !Array.isArray(snap) &&
        Object.keys(snap).length > 0
      ) {
        return snap as Record<string, any>;
      }
      const direct: Record<string, any> = {};
      if ('kundenr' in meta) direct.kundenr = (meta as Record<string, any>).kundenr;
      if ('customer_group_id' in meta) direct.customer_group_id = (meta as Record<string, any>).customer_group_id;
      if (Object.keys(direct).length > 0) return direct;
    }
    const rawNew = (entry as unknown as Record<string, any> | null | undefined)?.newData;
    if (rawNew && typeof rawNew === 'object' && !Array.isArray(rawNew) && Object.keys(rawNew).length > 0) {
      return rawNew as Record<string, any>;
    }
  } catch {
    return null;
  }
  return null;
}

/** Generic fallback for UPDATE metadata without `changes` (scalar fields only,
 * never crashes on null/nested objects). */
function getExtraMetadata(entry: AuditEntry): Record<string, any> | null {
  try {
    const meta = entry?.metadata as Record<string, any> | null | undefined;
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
    const { snapshot, newData, ...rest } = meta as Record<string, any>;
    void snapshot;
    void newData;
    const scalars = Object.entries(rest).filter(([, v]) => v === null || v === undefined || typeof v !== 'object');
    if (scalars.length > 0) return Object.fromEntries(scalars);
  } catch {
    return null;
  }
  return null;
}

/** Expanded detail pane for customer_group_member assign/remove audits. */
function MemberDetails({ details }: { details: Record<string, any> }) {
  const rows = Object.entries(details ?? {});
  return (
    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">
        Medlem
      </div>
      <div className="space-y-1">
        {rows.length === 0 ? (
          <div className="text-sm text-dark-400">(ingen flere detaljer)</div>
        ) : (
          rows.map(([field, value]) => (
            <div key={field} className="flex items-start gap-2 text-sm">
              <span className="text-dark-400 min-w-[120px] flex-shrink-0">
                {FIELD_LABELS[field] || field}:
              </span>
              <span className="text-dark-200">{formatValue(value, field)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/** Generic expanded pane for metadata without diffs. */
function MetadataDetails({ data }: { data: Record<string, any> }) {
  const rows = Object.entries(data ?? {});
  return (
    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">
        Detaljer
      </div>
      <div className="space-y-1">
        {rows.map(([field, value]) => (
          <div key={field} className="flex items-start gap-2 text-sm">
            <span className="text-dark-400 min-w-[120px] flex-shrink-0">
              {FIELD_LABELS[field] || field}:
            </span>
            <span className="text-dark-200">{formatValue(value, field)}</span>
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
            <span className="text-dark-200">{formatValue(value, field)}</span>
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
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const filters = useMemo(
    () => ({ filterType, filterAction }),
    [filterType, filterAction],
  );

  const auditQuery = useQuery({
    queryKey: pricingKeys.auditLog(page, filters),
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: LIMIT };
      if (filterType) params.entity_type = filterType;
      if (filterAction) params.action = filterAction;
      const res = await auditApi.getAll(params);
      return {
        entries: res.data.data as AuditEntry[],
        total: res.data.pagination.total as number,
      };
    },
  });

  const entries = auditQuery.data?.entries ?? [];
  const total = auditQuery.data?.total ?? 0;
  const isLoading = auditQuery.isLoading;

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
          <label htmlFor="audit-filter-type" className="sr-only">
            Filtrer etter type
          </label>
          <select
            id="audit-filter-type"
            value={filterType}
            onChange={handleTypeChange}
            className="input text-sm"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <label htmlFor="audit-filter-action" className="sr-only">
            Filtrer etter handling
          </label>
          <select
            id="audit-filter-action"
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
          <Spinner size="md" className="text-primary-500" label="Laster endringslogg…" />
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
              const changesCount = entry?.changes ? Object.keys(entry.changes).length : 0;
              const hasChanges = changesCount > 0;
              const deleteSnapshot =
                entry?.action === 'DELETE'
                  ? (entry?.metadata as Record<string, any> | null | undefined)?.snapshot
                  : undefined;
              const hasDeleteSnapshot =
                !!deleteSnapshot && typeof deleteSnapshot === 'object' && !Array.isArray(deleteSnapshot);
              // Assign/remove audits are UPDATE with only newData (no old) so
              // changes is null; entity_name already shows "kundenr -> group".
              // Expand when structured metadata/newData is present (safe on null).
              const memberDetails = getMemberDetails(entry);
              const extraMetadata = !hasChanges && !hasDeleteSnapshot ? getExtraMetadata(entry) : null;
              const hasDetails =
                hasChanges || hasDeleteSnapshot || memberDetails !== null || extraMetadata !== null;

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
                  {isExpanded && hasChanges && entry.changes && (
                    <UpdateDetails changes={entry.changes} />
                  )}
                  {isExpanded && !hasChanges && memberDetails && (
                    <MemberDetails details={memberDetails} />
                  )}
                  {isExpanded && !hasChanges && !memberDetails && extraMetadata && (
                    <MetadataDetails data={extraMetadata} />
                  )}
                  {isExpanded && hasDeleteSnapshot && (
                    <DeleteDetails snapshot={deleteSnapshot as Record<string, any>} />
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-dark-500 mt-3">
            Sletting av gruppe nullstiller gruppens regler til Alle kunder.
          </p>

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
