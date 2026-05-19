import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Layout } from '../../components/Layout';
import { ActionKeyModal, ConfirmModal, GridStatSkeleton, ListSkeleton } from '../../components/admin';
import { allowDestructiveEtl } from '../../lib/appConfig';
import { Tabs, TabContent } from '../../components/Tabs';
import { etlApi, schedulerApi } from '../../lib/api';

import { ActionResult, Job } from '../../types/etl';

export function AdminETL() {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<ActionResult[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'etl' | 'bulk' | 'scheduler'>('etl');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [tableCounts, setTableCounts] = useState<Record<string, number>>({});
  const [countsLoading, setCountsLoading] = useState(false);
  const [bulkConfig, setBulkConfig] = useState({
    customers: 1000,
    orders: 10000,
    linesPerOrder: 5,
  });
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    type: 'generate' | 'pipeline';
    config: { customers: number; orders: number; linesPerOrder: number };
  } | null>(null);
  const [pendingDestructive, setPendingDestructive] = useState<{
    id: string;
    label: string;
    api: () => Promise<unknown>;
  } | null>(null);

  const csvFileRef = useRef<HTMLInputElement>(null);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const response = await schedulerApi.getJobs();
      setJobs(response.data);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  const loadTableCounts = useCallback(async () => {
    setCountsLoading(true);
    try {
      const response = await etlApi.tableCounts();
      setTableCounts(response.data.counts || {});
    } catch (error) {
      console.error('Failed to load table counts:', error);
    } finally {
      setCountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'scheduler') {
      loadJobs();
    }
    if (activeTab === 'bulk') {
      loadTableCounts();
    }
  }, [activeTab, loadJobs, loadTableCounts]);

  const runAction = async (action: string, apiCall: () => Promise<any>) => {
    setIsLoading(action);
    try {
      const response = await apiCall();
      setResults(prev => [{
        action,
        success: response.data.success,
        message: response.data.message,
        data: response.data.details || response.data.data,
        timestamp: new Date(),
      }, ...prev]);
      if (activeTab === 'bulk') loadTableCounts();
      if (activeTab === 'scheduler') loadJobs();
      
      // Invalidate dashboard and analytics queries after data changes
      queryClient.invalidateQueries({ queryKey: ['admin'] });
      queryClient.invalidateQueries({ queryKey: ['statistics'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    } catch (error: any) {
      setResults(prev => [{
        action,
        success: false,
        error: error.response?.data?.error || error.message,
        timestamp: new Date(),
      }, ...prev]);
    } finally {
      setIsLoading(null);
    }
  };

  const estimatedPendingLines = pendingBulkAction
    ? pendingBulkAction.config.orders * pendingBulkAction.config.linesPerOrder
    : 0;

  const triggerBulkAction = (type: 'generate' | 'pipeline') => {
    const config = { ...bulkConfig };
    const estimatedLines = config.orders * config.linesPerOrder;
    if (estimatedLines > 1_000_000) {
      setPendingBulkAction({ type, config });
      return;
    }
    const labels = { generate: 'Generate Bulk', pipeline: 'Bulk Pipeline' };
    const apiCalls = {
      generate: () => etlApi.generateBulkData(config),
      pipeline: () => etlApi.runBulkPipeline(config),
    };
    runAction(labels[type], apiCalls[type]);
  };

  const etlActions = [
    { id: 'createDB', label: '🏗️ Opprett DB', api: etlApi.createDB, destructive: true },
    { id: 'truncateDB', label: '🗑️ Tøm DB', api: etlApi.truncateDB, destructive: true },
    { id: 'generateTestData', label: '🎲 Generer Test', api: etlApi.generateTestData, destructive: false },
    { id: 'insertTestData', label: '📥 Sett Inn Test', api: etlApi.insertTestData, destructive: false },
    { id: 'runFullTestPipeline', label: '🚀 Full Pipeline', api: etlApi.runFullTestPipeline, destructive: true },
  ];

  const handleEtlAction = (action: (typeof etlActions)[number]) => {
    if (action.destructive) {
      setPendingDestructive({ id: action.id, label: action.label, api: action.api });
      return;
    }
    void runAction(action.id, action.api);
  };

  return (
    <Layout title="ETL / Database Management">
      <div className="space-y-6">
        {/* Tabs */}
        <Tabs
          tabs={[
            { id: 'etl', label: 'ETL', icon: '🔧' },
            { id: 'bulk', label: 'Bulk Data', icon: '📊' },
            { id: 'scheduler', label: 'Scheduler', icon: '⏰' },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as typeof activeTab)}
          variant="pill"
        />

        {/* ETL Tab */}
        {activeTab === 'etl' && (
          <TabContent tabKey="etl">
            {!allowDestructiveEtl && (
              <div className="mb-4 rounded-lg border border-amber-700/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-100">
                Destruktive ETL-handlinger er deaktivert i produksjon.
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 stagger-fade-in">
              {etlActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleEtlAction(action)}
                  disabled={isLoading !== null || (action.destructive && !allowDestructiveEtl)}
                  className={`card-interactive text-center py-6 cursor-pointer ${
                    isLoading === action.id ? 'opacity-50' : ''
                  } ${action.destructive && !allowDestructiveEtl ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  <span className="text-2xl block mb-2">{action.label.split(' ')[0]}</span>
                  <span className="text-sm">{action.label.split(' ').slice(1).join(' ')}</span>
                </button>
              ))}
            </div>
          </TabContent>
        )}

        {/* Bulk Data Tab */}
        {activeTab === 'bulk' && (
          <TabContent tabKey="bulk">
            <div className="space-y-6 stagger-fade-in">
              {/* Table counts */}
              <div className="card">
                <h3 className="font-semibold mb-4">📊 Nåværende Data</h3>
                {countsLoading && Object.keys(tableCounts).length === 0 ? (
                  <GridStatSkeleton count={6} />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-fade-in">
                    {Object.entries(tableCounts).map(([table, count]) => (
                      <div key={table} className="bg-dark-800/50 p-3 rounded-lg transition-all duration-200 hover:bg-dark-800/80">
                        <span className="text-dark-400 text-sm capitalize">{table}</span>
                        <p className="text-xl font-bold">{count.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk configuration */}
              <div className="card">
                <h3 className="font-semibold mb-4">⚡ Generer Bulk Data</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="label">Antall Kunder</label>
                    <input
                      type="number"
                      value={bulkConfig.customers}
                      onChange={(e) => setBulkConfig({ ...bulkConfig, customers: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Antall Ordrer</label>
                    <input
                      type="number"
                      value={bulkConfig.orders}
                      onChange={(e) => setBulkConfig({ ...bulkConfig, orders: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                  <div>
                    <label className="label">Linjer per Ordre</label>
                    <input
                      type="number"
                      value={bulkConfig.linesPerOrder}
                      onChange={(e) => setBulkConfig({ ...bulkConfig, linesPerOrder: Number(e.target.value) })}
                      className="input"
                    />
                  </div>
                </div>
                <p className="text-sm text-dark-400 mb-4">
                  Estimert: ~{(bulkConfig.orders * bulkConfig.linesPerOrder).toLocaleString()} ordrelinjer
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => triggerBulkAction('generate')}
                    disabled={isLoading !== null}
                    className="btn-secondary"
                  >
                    🎲 Generer Data
                  </button>
                  <button
                    onClick={() => runAction('Insert Bulk', etlApi.insertBulkData)}
                    disabled={isLoading !== null}
                    className="btn-secondary"
                  >
                    📥 Sett Inn Data
                  </button>
                  <button
                    onClick={() => triggerBulkAction('pipeline')}
                    disabled={isLoading !== null}
                    className="btn-primary"
                  >
                    🚀 Full Bulk Pipeline
                  </button>
                </div>
              </div>

              {/* CSV Upload */}
              <div className="card">
                <h3 className="font-semibold mb-4">📤 Last opp CSV</h3>
                <div className="space-y-4">
                  <div className="flex-1">
                    <label className="label">Velg CSV Fil</label>
                    <input
                      type="file"
                      accept=".csv"
                      ref={csvFileRef}
                      className="input"
                    />
                  </div>
                  
                  <div className="bg-blue-900/20 p-4 rounded-lg border border-blue-800/30">
                    <h4 className="text-sm font-semibold text-blue-400 mb-2">Instruksjoner:</h4>
                    <ul className="text-xs text-dark-300 space-y-1 list-disc pl-4">
                      <li>Filen må være en CSV med <b>header-rad</b>.</li>
                      <li>Systemet vil automatisk gjenkjenne tabellen basert på kolonnenavnene.</li>
                      <li>Eksisterende rader (basert på primærnøkkel) vil bli hoppet over.</li>
                      <li>Støttede tabeller: Ordre, Ordrelinje, Kunde, Vare, Firma, Lager.</li>
                    </ul>
                  </div>

                  <button
                    onClick={() => {
                      const file = csvFileRef.current?.files?.[0];
                      if (!file) {
                        setResults(prev => [{
                          action: 'Last opp CSV',
                          success: false,
                          error: 'Ingen fil valgt',
                          timestamp: new Date(),
                        }, ...prev]);
                        return;
                      }
                      runAction(`Last opp CSV`, () => etlApi.uploadCsv('', file));
                    }}
                    disabled={isLoading !== null}
                    className="btn-primary w-full md:w-auto"
                  >
                    {isLoading === 'Last opp CSV' ? '⏳ Laster opp...' : '📤 Last Opp'}
                  </button>
                </div>
              </div>
            </div>
          </TabContent>
        )}

        {/* Scheduler Tab */}
        {activeTab === 'scheduler' && (
          <TabContent tabKey="scheduler">
            <div className="space-y-6">
              <div className="card">
                <h3 className="font-semibold mb-4">⏰ Planlagte Jobber</h3>
                {jobsLoading && jobs.length === 0 ? (
                  <ListSkeleton count={3} />
                ) : (
                <div className="space-y-3 stagger-fade-in">
                  {jobs.map((job) => (
                    <div key={job.id} className="flex items-center justify-between bg-dark-800/50 p-4 rounded-lg transition-all duration-200 hover:bg-dark-800/80">
                      <div>
                        <h4 className="font-medium">{job.name}</h4>
                        <p className="text-sm text-dark-400">{job.cronExpression}</p>
                        {job.lastRun && (
                          <p className="text-xs text-dark-500">
                            Sist kjørt: {new Date(job.lastRun).toLocaleString('nb-NO')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-1 rounded text-xs ${
                          job.status === 'running' ? 'bg-blue-600/20 text-blue-400' :
                          job.status === 'error' ? 'bg-red-600/20 text-red-400' :
                          'bg-green-600/20 text-green-400'
                        }`}>
                          {job.status}
                        </span>
                        <button
                          onClick={() => runAction(`Run ${job.id}`, () => schedulerApi.runJob(job.id))}
                          className="btn-secondary text-sm"
                          disabled={isLoading !== null}
                        >
                          ▶️ Kjør Nå
                        </button>
                        <button
                          onClick={() => job.enabled 
                            ? runAction(`Stop ${job.id}`, () => schedulerApi.stopJob(job.id))
                            : runAction(`Start ${job.id}`, () => schedulerApi.startJob(job.id))
                          }
                          className={`text-sm ${job.enabled ? 'btn-danger' : 'btn-primary'}`}
                          disabled={isLoading !== null}
                        >
                          {job.enabled ? '⏹️ Stopp' : '▶️ Start'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                )}
              </div>
            </div>
          </TabContent>
        )}

        {/* Results Log */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">📋 Resultatlogg</h3>
            {results.length > 0 && (
              <button onClick={() => setResults([])} className="btn-secondary text-sm">
                Tøm
              </button>
            )}
          </div>
          {results.length === 0 ? (
            <p className="text-dark-400 text-center py-4">Ingen handlinger utført ennå.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {results.slice(0, 10).map((result) => (
                <div
                  key={result.timestamp.getTime()}
                  className={`p-3 rounded-lg text-sm ${
                    result.success ? 'bg-green-900/20' : 'bg-red-900/20'
                  }`}
                >
                  <div className="flex justify-between">
                    <span>{result.success ? '✅' : '❌'} {result.action}</span>
                    <span className="text-dark-500">{result.timestamp.toLocaleTimeString()}</span>
                  </div>
                  {result.message && <p className="text-dark-300 mt-1">{result.message}</p>}
                  {result.error && <p className="text-red-400 mt-1">{result.error}</p>}
                  {result.data && (
                    <pre className="mt-1 text-xs text-dark-400 overflow-x-auto">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action key modal for large bulk operations */}
      <ConfirmModal
        open={!!pendingDestructive}
        onClose={() => setPendingDestructive(null)}
        onConfirm={() => {
          if (!pendingDestructive) return;
          void runAction(pendingDestructive.id, pendingDestructive.api);
          setPendingDestructive(null);
        }}
        title="Bekreft destruktiv handling"
        confirmLabel="Utfør"
        intent="danger"
        loading={isLoading !== null}
      >
        <p>
          Er du sikker på at du vil kjøre <strong>{pendingDestructive?.label}</strong>? Denne handlingen
          kan ikke angres.
        </p>
      </ConfirmModal>

      <ActionKeyModal
        open={!!pendingBulkAction}
        onClose={() => setPendingBulkAction(null)}
        onConfirm={(actionKey) => {
          if (!pendingBulkAction) return;
          const config = pendingBulkAction.config;
          if (pendingBulkAction.type === 'generate') {
            runAction('Generate Bulk', () => etlApi.generateBulkData({ ...config, actionKey }));
          } else {
            runAction('Bulk Pipeline', () => etlApi.runBulkPipeline({ ...config, actionKey }));
          }
          setPendingBulkAction(null);
        }}
        title="Sikkerhetskode kreves"
        description={`Operasjonen vil generere omtrent ${estimatedPendingLines.toLocaleString()} ordrelinjer. Skriv inn sikkerhetskoden for å fortsette.`}
        confirmLabel="Fortsett"
      />
    </Layout>
  );
}
