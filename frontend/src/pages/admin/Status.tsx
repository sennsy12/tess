import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { statusApi } from '../../lib/api';

import { ApiEndpointMetric, ApiMetricsData } from '../../types/status';

export function AdminStatus() {
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: null,
    sortDirection: null,
    currentPage: 1,
    visibleColumnKeys: ['method', 'path', 'avgMs', 'minMs', 'maxMs', 'count', 'slowCount'],
  });

  const { data: systemStatus, refetch: refetchSystem } = useQuery({
    queryKey: ['admin', 'status'],
    queryFn: () => statusApi.getStatus().then(res => res.data),
  });

  const { data: importStatus, refetch: refetchImport } = useQuery({
    queryKey: ['admin', 'import-status'],
    queryFn: () => statusApi.getImportStatus().then(res => res.data),
  });

  const { data: extractionStatus, refetch: refetchExtraction } = useQuery({
    queryKey: ['admin', 'extraction-status'],
    queryFn: () => statusApi.getExtractionStatus().then(res => res.data),
  });

  const { data: healthStatus, refetch: refetchHealth } = useQuery({
    queryKey: ['admin', 'health'],
    queryFn: () => statusApi.getHealth().then(res => res.data),
  });

  const { data: apiMetrics, refetch: refetchMetrics } = useQuery<ApiMetricsData>({
    queryKey: ['admin', 'api-metrics'],
    queryFn: () => statusApi.getApiMetrics().then(res => res.data),
  });
  

  const loadAllStatus = async () => {
    await Promise.all([
      refetchSystem(),
      refetchImport(),
      refetchExtraction(),
      refetchHealth(),
      refetchMetrics(),
    ]);
  };

  const isLoading = !systemStatus || !importStatus || !extractionStatus || !healthStatus || !apiMetrics;

  const endpointColumns = [
    {
      key: 'method',
      header: 'Metode',
      render: (value: string) => (
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          value === 'GET' ? 'bg-blue-500/20 text-blue-400' :
          value === 'POST' ? 'bg-green-500/20 text-green-400' :
          value === 'PUT' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-red-500/20 text-red-400'
        }`}>
          {value}
        </span>
      ),
    },
    { key: 'path', header: 'Endepunkt', hideable: false },
    { key: 'avgMs', header: 'Snitt (ms)', align: 'right' as const },
    { key: 'minMs', header: 'Min (ms)', align: 'right' as const },
    { key: 'maxMs', header: 'Maks (ms)', align: 'right' as const },
    { key: 'count', header: 'Kall', align: 'right' as const },
    { key: 'slowCount', header: 'Trege', align: 'right' as const },
  ];

  const StatusCard = ({ title, status, children }: { title: string; status: string; children: React.ReactNode }) => (
    <div className={`card ${status === 'ok' || status === 'healthy' ? 'border-green-700/50' : 'border-red-700/50'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${status === 'ok' || status === 'healthy' ? 'bg-green-500' : 'bg-red-500'}`}></div>
        <h3 className="text-lg font-semibold">{title}</h3>
        <span className={`ml-auto px-2 py-1 rounded text-xs font-medium ${
          status === 'ok' || status === 'healthy' 
            ? 'bg-green-600/20 text-green-400' 
            : 'bg-red-600/20 text-red-400'
        }`}>
          {status?.toUpperCase()}
        </span>
      </div>
      {children}
    </div>
  );

  if (isLoading) {
    return (
      <Layout title="System Status">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="System Status">
      <div className="space-y-6">
        {/* Refresh button */}
        <div className="flex justify-end">
          <button onClick={loadAllStatus} className="btn-secondary">
            🔄 Oppdater Status
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <StatusCard title="System Status" status={systemStatus?.status}>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Database</span>
                <span className={systemStatus?.database?.connected ? 'text-green-400' : 'text-red-400'}>
                  {systemStatus?.database?.connected ? '✅ Tilkoblet' : '❌ Frakoblet'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Tidsstempel</span>
                <span>{new Date(systemStatus?.timestamp).toLocaleString('nb-NO')}</span>
              </div>
              <div className="pt-3 border-t border-dark-800">
                <span className="text-sm text-dark-400">Tabeller i database:</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {systemStatus?.tables && Object.entries(systemStatus.tables).map(([key, value]) => (
                    <div key={key} className="flex justify-between bg-dark-800/50 p-2 rounded">
                      <span className="text-dark-300 capitalize">{key}</span>
                      <span className="font-mono">{String(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </StatusCard>

          {/* Health Status */}
          <StatusCard title="Backend Helse" status={healthStatus?.status}>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Kjøretid</span>
                <span>{healthStatus?.backend?.uptime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Node.js versjon</span>
                <span className="font-mono">{healthStatus?.backend?.nodeVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Heap brukt</span>
                <span className="font-mono">{healthStatus?.backend?.memory?.heapUsed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Heap totalt</span>
                <span className="font-mono">{healthStatus?.backend?.memory?.heapTotal}</span>
              </div>
            </div>
          </StatusCard>

          {/* Import Status */}
          <StatusCard title="Data Import Status" status={importStatus?.status}>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Siste import</span>
                <span>{importStatus?.lastImport ? new Date(importStatus.lastImport).toLocaleString('nb-NO') : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Totale ordrer</span>
                <span className="font-mono">{importStatus?.totalOrders}</span>
              </div>
              {importStatus?.latestOrder && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Nyeste ordre</span>
                  <span>#{importStatus.latestOrder.ordrenr} ({new Date(importStatus.latestOrder.dato).toLocaleDateString('nb-NO')})</span>
                </div>
              )}
              <div className="pt-3 border-t border-dark-800">
                <span className="text-sm text-dark-400">{importStatus?.message}</span>
              </div>
            </div>
          </StatusCard>

          {/* Extraction Status */}
          <StatusCard title="Data Extraction Status" status={extractionStatus?.status}>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Siste uttrekk</span>
                <span>{extractionStatus?.lastExtraction ? new Date(extractionStatus.lastExtraction).toLocaleString('nb-NO') : '-'}</span>
              </div>
              {extractionStatus?.details && (
                <>
                  <div className="flex justify-between">
                    <span className="text-dark-400">Kilde</span>
                    <span>{extractionStatus.details.source}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-400">Destinasjon</span>
                    <span>{extractionStatus.details.destination}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-dark-400">Status</span>
                    <span className={extractionStatus.details.healthy ? 'text-green-400' : 'text-red-400'}>
                      {extractionStatus.details.healthy ? '✅ Sunn' : '❌ Problemer'}
                    </span>
                  </div>
                </>
              )}
              <div className="pt-3 border-t border-dark-800">
                <span className="text-sm text-dark-400">{extractionStatus?.message}</span>
              </div>
            </div>
          </StatusCard>
        </div>

        {/* API Performance Metrics - Full Width */}
        {apiMetrics && (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-3 h-3 rounded-full ${apiMetrics.summary.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
              <h3 className="text-lg font-semibold">⚡ API Ytelse</h3>
              <span className={`ml-auto px-2 py-1 rounded text-xs font-medium ${
                apiMetrics.summary.status === 'ok' 
                  ? 'bg-green-600/20 text-green-400' 
                  : 'bg-yellow-600/20 text-yellow-400'
              }`}>
                {apiMetrics.summary.totalSlowRequests > 0 
                  ? `${apiMetrics.summary.totalSlowRequests} TREGE` 
                  : 'OK'}
              </span>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-dark-800/50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold">{apiMetrics.summary.totalEndpoints}</p>
                <p className="text-xs text-dark-400">Endepunkter</p>
              </div>
              <div className="bg-dark-800/50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold">{apiMetrics.summary.totalRequests}</p>
                <p className="text-xs text-dark-400">Totale kall</p>
              </div>
              <div className={`p-3 rounded-lg text-center ${apiMetrics.summary.totalSlowRequests > 0 ? 'bg-yellow-500/20' : 'bg-dark-800/50'}`}>
                <p className={`text-2xl font-bold ${apiMetrics.summary.totalSlowRequests > 0 ? 'text-yellow-400' : ''}`}>
                  {apiMetrics.summary.totalSlowRequests}
                </p>
                <p className="text-xs text-dark-400">{"Trege (>1s)"}</p>
              </div>
              <div className="bg-dark-800/50 p-3 rounded-lg text-center">
                <p className="text-2xl font-bold text-primary-400">
                  {apiMetrics.summary.slowestEndpoint?.avgMs || 0}ms
                </p>
                <p className="text-xs text-dark-400">Tregeste snitt</p>
              </div>
            </div>

            {/* Endpoint List */}
            {apiMetrics.endpoints.length > 0 && (
              <>
                <h4 className="text-sm font-medium text-dark-300 mb-3">Endepunkter (sortert etter responstid)</h4>
                <DataTable
                  data={apiMetrics.endpoints.slice(0, 15)}
                  columns={endpointColumns}
                  emptyMessage="Ingen endepunkter registrert ennå"
                  paginate={false}
                  stickyFirstColumn
                  enableColumnManagement
                  enableCsvExport
                  exportFilename="api-endpoint-metrics"
                  title="API-endepunkter"
                  storageKey="table:admin-status-api-metrics"
                  state={tableState}
                  onStateChange={setTableState}
                  rowKey={(row: ApiEndpointMetric) => `${row.method}-${row.path}`}
                />
                {apiMetrics.endpoints.length > 15 && (
                  <p className="text-xs text-dark-500 mt-2">Viser første 15 av {apiMetrics.endpoints.length} endepunkter</p>
                )}
              </>
            )}

            {apiMetrics.endpoints.length === 0 && (
              <p className="text-dark-400 text-center py-4">Ingen API-kall registrert ennå. Bruk applikasjonen for å generere data.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
