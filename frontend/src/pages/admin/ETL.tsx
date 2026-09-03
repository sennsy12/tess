import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, Clock, Radio, Wrench } from 'lucide-react';
import { Layout } from '../../components/Layout';
import { ActionKeyModal, ConfirmModal } from '../../components/admin';
import { Tabs, TabContent } from '../../components/Tabs';
import { etlApi, schedulerApi } from '../../lib/api';
import { useEtlJobsList } from '../../hooks/useEtlJobs';
import { etlKeys, schedulerKeys } from '../../lib/queryKeys';
import { getApiError } from '../../lib/apiErrors';
import { EtlActionsPanel, type EtlActionDefinition } from './etl/EtlActionsPanel';
import { BulkDataPanel, type BulkConfig } from './etl/BulkDataPanel';
import { EtlJobsPanel } from './etl/EtlJobsPanel';
import { SchedulerPanel } from './etl/SchedulerPanel';
import { ActionResult } from '../../types/etl';

type EtlPageTab = 'etl' | 'bulk' | 'jobs' | 'scheduler';

const RESULTS_LOG_LIMIT = 50;

function extractJobId(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined;
  const record = data as Record<string, unknown>;
  if (typeof record.jobId === 'string') return record.jobId;
  const details = record.details;
  if (details && typeof details === 'object' && typeof (details as Record<string, unknown>).jobId === 'string') {
    return (details as Record<string, unknown>).jobId as string;
  }
  return undefined;
}

function appendResult(prev: ActionResult[], entry: ActionResult): ActionResult[] {
  return [entry, ...prev].slice(0, RESULTS_LOG_LIMIT);
}

export function AdminETL() {
  const queryClient = useQueryClient();
  const [results, setResults] = useState<ActionResult[]>([]);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<EtlPageTab>('etl');
  const [focusJobId, setFocusJobId] = useState<string | null>(null);
  const [bulkConfig, setBulkConfig] = useState<BulkConfig>({
    customers: 1000,
    orders: 10000,
    linesPerOrder: 5,
  });
  const [pendingBulkAction, setPendingBulkAction] = useState<{
    type: 'generate' | 'pipeline';
    config: BulkConfig;
  } | null>(null);
  const [pendingDestructive, setPendingDestructive] = useState<{
    id: string;
    label: string;
    api: () => Promise<unknown>;
  } | null>(null);

  const csvFileRef = useRef<HTMLInputElement>(null);
  const xlsxFileRef = useRef<HTMLInputElement>(null);
  const [xlsxSheet, setXlsxSheet] = useState('');

  const schedulerJobsQuery = useQuery({
    queryKey: schedulerKeys.jobs(),
    queryFn: () => schedulerApi.getJobs().then((r) => r.data),
    enabled: activeTab === 'scheduler',
    staleTime: 30_000,
  });

  const tableCountsQuery = useQuery({
    queryKey: etlKeys.tableCounts(),
    queryFn: () => etlApi.tableCounts().then((r) => r.data.counts ?? {}),
    enabled: activeTab === 'bulk',
  });

  const etlJobsQuery = useEtlJobsList(50);

  const activePipelineJobs =
    etlJobsQuery.data?.filter((j) => j.status === 'running' || j.status === 'pending').length ?? 0;

  const isLoading = loadingActionId !== null;

  const invalidateAfterDataChange = () => {
    void queryClient.invalidateQueries({ queryKey: etlKeys.tableCounts() });
    void queryClient.invalidateQueries({ queryKey: schedulerKeys.jobs() });
    void queryClient.invalidateQueries({ queryKey: etlKeys.all() });
    // Deliberate cross-scope sweeps after an import replaces large
    // portions of the data: everything admin-, statistics- and
    // order-related (kunde included) is potentially stale.
    void queryClient.invalidateQueries({ queryKey: ['admin'] });
    void queryClient.invalidateQueries({ queryKey: ['statistics'] });
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  };

  const runAction = async (action: string, apiCall: () => Promise<{ data: Record<string, unknown> }>) => {
    setLoadingActionId(action);
    try {
      const response = await apiCall();
      setResults((prev) =>
        appendResult(prev, {
          action,
          success: Boolean(response.data.success),
          message: response.data.message as string | undefined,
          data: (response.data.details || response.data.data) as Record<string, unknown> | undefined,
          timestamp: new Date(),
        }),
      );

      invalidateAfterDataChange();

      const jobId = extractJobId(response.data);
      if (jobId) {
        setFocusJobId(jobId);
        setActiveTab('jobs');
      }
    } catch (error: unknown) {
      const message = getApiError(error, 'Ukjent feil');
      setResults((prev) =>
        appendResult(prev, {
          action,
          success: false,
          error: message,
          timestamp: new Date(),
        }),
      );
    } finally {
      setLoadingActionId(null);
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
    void runAction(labels[type], apiCalls[type]);
  };

  const handleEtlAction = (action: EtlActionDefinition) => {
    if (action.destructive) {
      setPendingDestructive({ id: action.id, label: action.label, api: action.api });
      return;
    }
    void runAction(action.id, action.api as () => Promise<{ data: Record<string, unknown> }>);
  };

  const handleCsvUpload = () => {
    const file = csvFileRef.current?.files?.[0];
    if (!file) {
      setResults((prev) =>
        appendResult(prev, {
          action: 'Last opp CSV',
          success: false,
          error: 'Ingen fil valgt',
          timestamp: new Date(),
        }),
      );
      return;
    }
    void runAction('Last opp CSV', () => etlApi.uploadCsv('', file));
  };

  const handleXlsxUpload = () => {
    const file = xlsxFileRef.current?.files?.[0];
    if (!file) {
      setResults((prev) =>
        appendResult(prev, {
          action: 'Last opp XLSX',
          success: false,
          error: 'Ingen fil valgt',
          timestamp: new Date(),
        }),
      );
      return;
    }
    const sheet = xlsxSheet.trim();
    void runAction('Last opp XLSX', () => etlApi.uploadXlsx('', file, sheet || undefined));
  };

  return (
    <Layout title="ETL / Database Management">
      <div className="space-y-6">
        <Tabs
          tabs={[
            { id: 'etl', label: 'ETL', icon: <Wrench className="h-4 w-4" aria-hidden /> },
            { id: 'bulk', label: 'Bulk Data', icon: <BarChart3 className="h-4 w-4" aria-hidden /> },
            {
              id: 'jobs',
              label: activePipelineJobs > 0 ? `Jobber (${activePipelineJobs})` : 'Jobber',
              icon: <Radio className="h-4 w-4" aria-hidden />,
            },
            { id: 'scheduler', label: 'Scheduler', icon: <Clock className="h-4 w-4" aria-hidden /> },
          ]}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as EtlPageTab)}
          variant="pill"
        />

        {activeTab === 'etl' && (
          <TabContent tabKey="etl">
            <EtlActionsPanel
              isLoading={isLoading}
              loadingActionId={loadingActionId}
              onAction={handleEtlAction}
            />
          </TabContent>
        )}

        {activeTab === 'bulk' && (
          <TabContent tabKey="bulk">
            <BulkDataPanel
              bulkConfig={bulkConfig}
              onBulkConfigChange={setBulkConfig}
              tableCounts={tableCountsQuery.data ?? {}}
              countsLoading={tableCountsQuery.isLoading}
              isLoading={isLoading}
              loadingActionId={loadingActionId}
              csvFileRef={csvFileRef}
              xlsxFileRef={xlsxFileRef}
              xlsxSheet={xlsxSheet}
              onXlsxSheetChange={setXlsxSheet}
              onGenerate={() => triggerBulkAction('generate')}
              onInsert={() => void runAction('Insert Bulk', etlApi.insertBulkData)}
              onPipeline={() => triggerBulkAction('pipeline')}
              onCsvUpload={handleCsvUpload}
              onXlsxUpload={handleXlsxUpload}
            />
          </TabContent>
        )}

        {activeTab === 'jobs' && (
          <TabContent tabKey="jobs">
            <EtlJobsPanel focusJobId={focusJobId} onFocusConsumed={() => setFocusJobId(null)} />
          </TabContent>
        )}

        {activeTab === 'scheduler' && (
          <TabContent tabKey="scheduler">
            <SchedulerPanel
              jobs={schedulerJobsQuery.data ?? []}
              isLoading={schedulerJobsQuery.isLoading}
              actionLoading={isLoading}
              onRunJob={(jobId) => void runAction(`Run ${jobId}`, () => schedulerApi.runJob(jobId))}
              onToggleJob={(job) =>
                void runAction(
                  job.enabled ? `Stop ${job.id}` : `Start ${job.id}`,
                  () => (job.enabled ? schedulerApi.stopJob(job.id) : schedulerApi.startJob(job.id)),
                )
              }
            />
          </TabContent>
        )}

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Resultatlogg</h3>
            {results.length > 0 && (
              <button type="button" onClick={() => setResults([])} className="btn-secondary text-sm">
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
                    <span>
                      {result.success ? 'OK' : 'Feil'} {result.action}
                    </span>
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

      <ConfirmModal
        open={!!pendingDestructive}
        onClose={() => setPendingDestructive(null)}
        onConfirm={() => {
          if (!pendingDestructive) return;
          void runAction(
            pendingDestructive.id,
            pendingDestructive.api as () => Promise<{ data: Record<string, unknown> }>,
          );
          setPendingDestructive(null);
        }}
        title="Bekreft destruktiv handling"
        confirmLabel="Utfør"
        intent="danger"
        loading={isLoading}
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
            void runAction('Generate Bulk', () => etlApi.generateBulkData({ ...config, actionKey }));
          } else {
            void runAction('Bulk Pipeline', () => etlApi.runBulkPipeline({ ...config, actionKey }));
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
