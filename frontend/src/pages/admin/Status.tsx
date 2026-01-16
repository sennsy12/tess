import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { statusApi } from '../../lib/api';

export function AdminStatus() {
  const [systemStatus, setSystemStatus] = useState<any>(null);
  const [importStatus, setImportStatus] = useState<any>(null);
  const [extractionStatus, setExtractionStatus] = useState<any>(null);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAllStatus();
  }, []);

  const loadAllStatus = async () => {
    try {
      const [systemRes, importRes, extractionRes, healthRes] = await Promise.all([
        statusApi.getStatus(),
        statusApi.getImportStatus(),
        statusApi.getExtractionStatus(),
        statusApi.getHealth(),
      ]);

      setSystemStatus(systemRes.data);
      setImportStatus(importRes.data);
      setExtractionStatus(extractionRes.data);
      setHealthStatus(healthRes.data);
    } catch (error) {
      console.error('Failed to load status:', error);
    } finally {
      setIsLoading(false);
    }
  };

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
      </div>
    </Layout>
  );
}
