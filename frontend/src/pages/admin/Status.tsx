import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { DataTable, type DataTableState } from '../../components/DataTable';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { statusApi } from '../../lib/api';
import { statusKeys } from '../../lib/queryKeys';
import { ApiEndpointMetric, ApiMetricsData } from '../../types/status';

function StatusCard({
  title,
  status,
  isLoading,
  isError,
  onRetry,
  children,
}: {
  title: string;
  status?: string;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="card animate-pulse">
        <div className="h-6 w-32 bg-dark-700/50 rounded mb-4" />
        <div className="space-y-2">
          <div className="h-4 bg-dark-700/40 rounded" />
          <div className="h-4 bg-dark-700/40 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="card border-red-800/50">
        <h3 className="text-lg font-semibold mb-3">{title}</h3>
        <QueryErrorBanner message={`Kunne ikke laste ${title.toLowerCase()}.`} onRetry={onRetry} />
      </div>
    );
  }

  const ok = status === 'ok' || status === 'healthy';

  return (
    <div className={`card ${ok ? 'border-green-700/50' : 'border-red-700/50'}`}>
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-3 h-3 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
        <h3 className="text-lg font-semibold">{title}</h3>
        <span
          className={`ml-auto px-2 py-1 rounded text-xs font-medium ${
            ok ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
          }`}
        >
          {status?.toUpperCase() ?? '—'}
        </span>
      </div>
      {children}
    </div>
  );
}

export function AdminStatus() {
  const queryClient = useQueryClient();
  const [tableState, setTableState] = useState<DataTableState>({
    sortKey: null,
    sortDirection: null,
    currentPage: 1,
    visibleColumnKeys: ['method', 'path', 'avgMs', 'minMs', 'maxMs', 'count', 'slowCount'],
  });

  const systemQuery = useQuery({
    queryKey: statusKeys.system(),
    queryFn: () => statusApi.getStatus().then((res) => res.data),
  });

  const importQuery = useQuery({
    queryKey: statusKeys.import(),
    queryFn: () => statusApi.getImportStatus().then((res) => res.data),
  });

  const extractionQuery = useQuery({
    queryKey: statusKeys.extraction(),
    queryFn: () => statusApi.getExtractionStatus().then((res) => res.data),
  });

  const healthQuery = useQuery({
    queryKey: statusKeys.health(),
    queryFn: () => statusApi.getHealth().then((res) => res.data),
  });

  const apiMetricsQuery = useQuery<ApiMetricsData>({
    queryKey: statusKeys.apiMetrics(),
    queryFn: () => statusApi.getApiMetrics().then((res) => res.data),
  });

  const etlMetricsQuery = useQuery({
    queryKey: statusKeys.etlMetrics(),
    queryFn: () => statusApi.getEtlMetrics().then((res) => res.data),
  });

  const loadAllStatus = () => {
    void queryClient.invalidateQueries({ queryKey: statusKeys.system() });
    void queryClient.invalidateQueries({ queryKey: statusKeys.import() });
    void queryClient.invalidateQueries({ queryKey: statusKeys.extraction() });
    void queryClient.invalidateQueries({ queryKey: statusKeys.health() });
    void queryClient.invalidateQueries({ queryKey: statusKeys.apiMetrics() });
    void queryClient.invalidateQueries({ queryKey: statusKeys.etlMetrics() });
  };

  const systemStatus = systemQuery.data;
  const importStatus = importQuery.data;
  const extractionStatus = extractionQuery.data;
  const healthStatus = healthQuery.data;
  const apiMetrics = apiMetricsQuery.data;
  const etlMetrics = etlMetricsQuery.data;

  const endpointColumns = [
    {
      key: 'method',
      header: 'Metode',
      render: (value: string) => (
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            value === 'GET'
              ? 'bg-blue-500/20 text-blue-400'
              : value === 'POST'
                ? 'bg-green-500/20 text-green-400'
                : value === 'PUT'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
          }`}
        >
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

  return (
    <Layout title="System Status">
      <div className="space-y-6">
        <div className="flex justify-end">
          <button type="button" onClick={loadAllStatus} className="btn-secondary">
            Oppdater status
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StatusCard
            title="System Status"
            status={systemStatus?.status}
            isLoading={systemQuery.isLoading}
            isError={systemQuery.isError}
            onRetry={() => systemQuery.refetch()}
          >
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Database</span>
                <span className={systemStatus?.database?.connected ? 'text-green-400' : 'text-red-400'}>
                  {systemStatus?.database?.connected ? 'Tilkoblet' : 'Frakoblet'}
                </span>
              </div>
              {systemStatus?.timestamp && (
                <div className="flex justify-between">
                  <span className="text-dark-400">Tidsstempel</span>
                  <span>{new Date(systemStatus.timestamp).toLocaleString('nb-NO')}</span>
                </div>
              )}
              {systemStatus?.tables && (
                <div className="pt-3 border-t border-dark-800">
                  <span className="text-sm text-dark-400">Tabeller i database:</span>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {Object.entries(systemStatus.tables).map(([key, value]) => (
                      <div key={key} className="flex justify-between bg-dark-800/50 p-2 rounded">
                        <span className="text-dark-300 capitalize">{key}</span>
                        <span className="font-mono">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </StatusCard>

          <StatusCard
            title="Backend Helse"
            status={healthStatus?.status}
            isLoading={healthQuery.isLoading}
            isError={healthQuery.isError}
            onRetry={() => healthQuery.refetch()}
          >
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
            </div>
          </StatusCard>

          <StatusCard
            title="Data Import Status"
            status={importStatus?.status}
            isLoading={importQuery.isLoading}
            isError={importQuery.isError}
            onRetry={() => importQuery.refetch()}
          >
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-dark-400">Siste import</span>
                <span>
                  {importStatus?.lastImport
                    ? new Date(importStatus.lastImport).toLocaleString('nb-NO')
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-400">Totale ordrer</span>
                <span className="font-mono">{importStatus?.totalOrders}</span>
              </div>
              {importStatus?.message && (
                <p className="text-sm text-dark-400 pt-3 border-t border-dark-800">{importStatus.message}</p>
              )}
            </div>
          </StatusCard>

          <StatusCard
            title="Data Extraction Status"
            status={extractionStatus?.status}
            isLoading={extractionQuery.isLoading}
            isError={extractionQuery.isError}
            onRetry={() => extractionQuery.refetch()}
          >
            <div className="space-y-3">
              {extractionStatus?.message && (
                <p className="text-sm text-dark-400">{extractionStatus.message}</p>
              )}
            </div>
          </StatusCard>
        </div>

        {etlMetricsQuery.isError ? (
          <QueryErrorBanner
            message="Kunne ikke laste ETL-kjøringshistorikk."
            onRetry={() => etlMetricsQuery.refetch()}
          />
        ) : etlMetrics && etlMetrics.recentRuns?.length > 0 ? (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">ETL kjøringshistorikk</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">Tid</th>
                    <th className="table-header text-right">Innsatt</th>
                    <th className="table-header text-right">Avvist</th>
                    <th className="table-header text-right">Rader/s</th>
                    <th className="table-header text-right">Varighet (ms)</th>
                  </tr>
                </thead>
                <tbody>
                  {etlMetrics.recentRuns.slice(0, 10).map((run: {
                    finishedAt: string;
                    insertedRows: number;
                    rejectedRows: number;
                    rowsPerSecond: number;
                    durationMs: number;
                  }, i: number) => (
                    <tr key={`${run.finishedAt}-${i}`}>
                      <td className="table-cell">
                        {new Date(run.finishedAt).toLocaleString('nb-NO')}
                      </td>
                      <td className="table-cell text-right">{run.insertedRows}</td>
                      <td className="table-cell text-right">{run.rejectedRows}</td>
                      <td className="table-cell text-right">{run.rowsPerSecond}</td>
                      <td className="table-cell text-right">{run.durationMs}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {apiMetricsQuery.isError ? (
          <QueryErrorBanner
            message="Kunne ikke laste API-ytelsesdata."
            onRetry={() => apiMetricsQuery.refetch()}
          />
        ) : apiMetrics ? (
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${apiMetrics.summary.status === 'ok' ? 'bg-green-500' : 'bg-yellow-500'}`}
              />
              <h3 className="text-lg font-semibold">API Ytelse</h3>
            </div>
            {apiMetrics.endpoints.length > 0 ? (
              <DataTable
                data={apiMetrics.endpoints.slice(0, 15)}
                columns={endpointColumns}
                emptyMessage="Ingen endepunkter registrert"
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
            ) : (
              <p className="text-dark-400 text-center py-4">Ingen API-kall registrert ennå.</p>
            )}
          </div>
        ) : apiMetricsQuery.isLoading ? (
          <div className="card animate-pulse h-48" />
        ) : null}
      </div>
    </Layout>
  );
}
