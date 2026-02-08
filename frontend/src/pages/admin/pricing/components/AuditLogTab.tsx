import { useState, useEffect } from 'react';
import { auditApi } from '../../../../lib/api';
import { AuditEntry } from '../types';

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

function formatValue(value: any): string {
  if (value === null || value === undefined) return '(tom)';
  if (typeof value === 'boolean') return value ? 'Ja' : 'Nei';
  return String(value);
}

function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString('nb-NO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export function AuditLogTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const limit = 25;

  useEffect(() => {
    loadEntries();
  }, [page, filterType, filterAction]);

  const loadEntries = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, any> = { page, limit };
      if (filterType) params.entity_type = filterType;
      if (filterAction) params.action = filterAction;
      const res = await auditApi.getAll(params);
      setEntries(res.data.data);
      setTotal(res.data.pagination.total);
    } catch (error: any) {
      console.error('Failed to load audit log:', error);
      // Better error handling for the UI
      if (error.response?.status === 403) {
        // If it's a 403, we might want to show a specific message or just an empty state
        setEntries([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="card">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold">Endringslogg</h3>
        <div className="flex gap-2">
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="input text-sm"
          >
            <option value="">Alle typer</option>
            <option value="customer_group">Kundegrupper</option>
            <option value="price_list">Prislister</option>
            <option value="price_rule">Prisregler</option>
          </select>
          <select
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="input text-sm"
          >
            <option value="">Alle handlinger</option>
            <option value="CREATE">Opprettet</option>
            <option value="UPDATE">Endret</option>
            <option value="DELETE">Slettet</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-dark-400">
          Ingen endringslogg-oppforinger funnet.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((entry) => {
              const actionInfo = ACTION_LABELS[entry.action] || { label: entry.action, className: 'bg-dark-700 text-dark-300' };
              const entityLabel = ENTITY_LABELS[entry.entity_type] || entry.entity_type;
              const isExpanded = expandedId === entry.id;
              const hasDetails = (entry.changes && Object.keys(entry.changes).length > 0)
                || (entry.action === 'DELETE' && entry.metadata?.snapshot);

              return (
                <div
                  key={entry.id}
                  className="rounded-lg border border-dark-700 overflow-hidden"
                >
                  <div
                    className={`flex flex-wrap items-center gap-3 px-4 py-3 ${hasDetails ? 'cursor-pointer hover:bg-dark-800/50' : ''}`}
                    onClick={() => hasDetails && setExpandedId(isExpanded ? null : entry.id)}
                  >
                    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${actionInfo.className}`}>
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
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    )}
                  </div>

                  {/* Expanded details */}
                  {isExpanded && entry.action === 'UPDATE' && entry.changes && (
                    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
                      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">Endringer</div>
                      <div className="space-y-1">
                        {Object.entries(entry.changes).map(([field, { old: oldVal, new: newVal }]) => (
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
                  )}

                  {isExpanded && entry.action === 'DELETE' && entry.metadata?.snapshot && (
                    <div className="px-4 pb-3 border-t border-dark-700 pt-3">
                      <div className="text-xs font-medium text-dark-400 mb-2 uppercase tracking-wide">Slettet data</div>
                      <div className="space-y-1">
                        {Object.entries(entry.metadata.snapshot)
                          .filter(([key]) => !['id', 'created_at', 'updated_at', 'price_list_name', 'customer_group_name', 'list_priority'].includes(key))
                          .map(([field, value]) => (
                            <div key={field} className="flex items-start gap-2 text-sm">
                              <span className="text-dark-400 min-w-[120px] flex-shrink-0">
                                {FIELD_LABELS[field] || field}:
                              </span>
                              <span className="text-dark-200">{formatValue(value)}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-dark-700">
              <span className="text-sm text-dark-400">
                Viser {(page - 1) * limit + 1}-{Math.min(page * limit, total)} av {total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Forrige
                </button>
                <span className="px-3 py-1 text-sm">
                  Side {page} av {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 rounded bg-dark-800 hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Neste
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
