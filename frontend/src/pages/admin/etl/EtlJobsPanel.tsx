import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Ban,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { EmptyState } from '../../../components/EmptyState';
import { Spinner } from '../../../components/Spinner';
import { ConfirmModal, ListSkeleton } from '../../../components/admin';
import { QueryErrorBanner } from '../../../components/QueryErrorBanner';
import {
  countJobsByStatus,
  filterEtlJobs,
  useCancelEtlJob,
  useEtlJobDetail,
  useEtlJobsList,
  type EtlJobFilter,
} from '../../../hooks/useEtlJobs';
import { subscribeEtlJobProgress } from '../../../lib/etlJobProgressStream';
import { formatNumberNb } from '../../../lib/formatters';
import type { EtlJobStatus, EtlPipelineJob } from '../../../types/etlJob';

const STATUS_LABELS: Record<EtlJobStatus, string> = {
  pending: 'Venter',
  running: 'Kjører',
  completed: 'Fullført',
  failed: 'Feilet',
  cancelled: 'Avbrutt',
};

const STATUS_STYLES: Record<EtlJobStatus, string> = {
  pending: 'bg-amber-600/20 text-amber-300',
  running: 'bg-blue-600/20 text-blue-300',
  completed: 'bg-green-600/20 text-green-300',
  failed: 'bg-red-600/20 text-red-300',
  cancelled: 'bg-dark-600/40 text-dark-300',
};

const SOURCE_LABELS: Record<string, string> = {
  csv: 'CSV',
  json: 'JSON',
  api: 'API',
  generator: 'Generator',
};

const FILTER_OPTIONS: { id: EtlJobFilter; label: string }[] = [
  { id: 'all', label: 'Alle' },
  { id: 'running', label: 'Kjører' },
  { id: 'pending', label: 'Venter' },
  { id: 'completed', label: 'Fullført' },
  { id: 'failed', label: 'Feilet' },
  { id: 'cancelled', label: 'Avbrutt' },
];

function StatusIcon({ status }: { status: EtlJobStatus }) {
  switch (status) {
    case 'running':
      return <Spinner size="xs" className="text-blue-400" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-400" aria-hidden />;
    case 'completed':
      return <CheckCircle2 className="h-4 w-4 text-green-400" aria-hidden />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-red-400" aria-hidden />;
    case 'cancelled':
      return <Ban className="h-4 w-4 text-dark-400" aria-hidden />;
  }
}

function ProgressBar({ percent }: { percent: number | null }) {
  const value = percent ?? 0;
  const indeterminate = percent === null;

  return (
    <div className="w-full">
      <div className="flex justify-between text-xs text-dark-400 mb-1">
        <span>Fremdrift</span>
        <span>{indeterminate ? '—' : `${Math.round(value)}%`}</span>
      </div>
      <div className="h-2 rounded-full bg-dark-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            indeterminate ? 'bg-primary-500/60 animate-pulse w-1/3' : 'bg-primary-500'
          }`}
          style={indeterminate ? undefined : { width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function formatDurationMs(startedAt: string, updatedAt: string): string {
  const ms = new Date(updatedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms} ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec} s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min} min ${remSec} s`;
}

function truncateJobId(jobId: string): string {
  if (jobId.length <= 14) return jobId;
  return `${jobId.slice(0, 8)}…${jobId.slice(-4)}`;
}

function mergeJob(
  listJob: EtlPipelineJob,
  live?: EtlPipelineJob | null,
): EtlPipelineJob {
  if (!live || live.jobId !== listJob.jobId) return listJob;
  return live.updatedAt >= listJob.updatedAt ? live : listJob;
}

function JobDetail({
  job,
  liveJob,
  onCancel,
  cancelling,
}: {
  job: EtlPipelineJob;
  liveJob: EtlPipelineJob | null;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const display = liveJob && liveJob.jobId === job.jobId ? liveJob : job;
  const canCancel = display.status === 'running' || display.status === 'pending';
  const showProgress =
    display.status === 'running' ||
    display.status === 'pending' ||
    (display.progressPercent !== null && display.progressPercent > 0);

  return (
    <div className="mt-3 pt-3 border-t border-dark-700/80 space-y-3 text-sm">
      {showProgress && <ProgressBar percent={display.progressPercent} />}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <p className="text-dark-500 text-xs">Forsøkt</p>
          <p className="font-medium">{formatNumberNb(display.attemptedRows)}</p>
        </div>
        <div>
          <p className="text-dark-500 text-xs">Innsatt</p>
          <p className="font-medium text-green-400">{formatNumberNb(display.insertedRows)}</p>
        </div>
        <div>
          <p className="text-dark-500 text-xs">Avvist</p>
          <p className="font-medium">{formatNumberNb(display.rejectedRows)}</p>
        </div>
        <div>
          <p className="text-dark-500 text-xs">Dead letter</p>
          <p className="font-medium">{formatNumberNb(display.deadLetterCount)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-dark-400">
        <span>Startet: {new Date(display.startedAt).toLocaleString('nb-NO')}</span>
        <span>Oppdatert: {new Date(display.updatedAt).toLocaleString('nb-NO')}</span>
        <span>Varighet: {formatDurationMs(display.startedAt, display.updatedAt)}</span>
        {display.estimatedTotal != null && (
          <span>Estimert totalt: {formatNumberNb(display.estimatedTotal)} rader</span>
        )}
      </div>

      {display.error && (
        <p className="text-red-400 text-xs rounded-lg bg-red-900/20 px-3 py-2">{display.error}</p>
      )}

      {canCancel && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          disabled={cancelling}
          className="btn-danger text-sm"
        >
          {cancelling ? 'Avbryter…' : 'Avbryt jobb'}
        </button>
      )}
    </div>
  );
}

interface EtlJobsPanelProps {
  focusJobId?: string | null;
  onFocusConsumed?: () => void;
}

export function EtlJobsPanel({ focusJobId, onFocusConsumed }: EtlJobsPanelProps) {
  const { data: jobs = [], isLoading, isError, refetch, isFetching } = useEtlJobsList(50);
  const cancelMutation = useCancelEtlJob();
  const [filter, setFilter] = useState<EtlJobFilter>('all');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [liveJobs, setLiveJobs] = useState<Record<string, EtlPipelineJob>>({});
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  const detailQuery = useEtlJobDetail(selectedJobId);

  useEffect(() => {
    if (!focusJobId) return;
    setSelectedJobId(focusJobId);
    setFilter('all');
    onFocusConsumed?.();
  }, [focusJobId, onFocusConsumed]);

  const filteredJobs = useMemo(() => filterEtlJobs(jobs, filter), [jobs, filter]);
  const statusCounts = useMemo(() => countJobsByStatus(jobs), [jobs]);
  const activeCount = statusCounts.running + statusCounts.pending;

  const subscribeLive = useCallback((jobId: string) => {
    return subscribeEtlJobProgress(
      jobId,
      (progress) => {
        setLiveJobs((prev) => ({ ...prev, [jobId]: progress }));
      },
      () => {
        void refetch();
      },
    );
  }, [refetch]);

  useEffect(() => {
    const runningIds = jobs
      .filter((j) => j.status === 'running' || j.status === 'pending')
      .map((j) => j.jobId);

    if (selectedJobId && !runningIds.includes(selectedJobId)) {
      const selected = jobs.find((j) => j.jobId === selectedJobId);
      if (selected && (selected.status === 'running' || selected.status === 'pending')) {
        runningIds.push(selectedJobId);
      }
    }

    const unsubs = runningIds.map((id) => subscribeLive(id));
    return () => unsubs.forEach((u) => u());
  }, [jobs, selectedJobId, subscribeLive]);

  const handleCancelConfirm = () => {
    if (!cancelTargetId) return;
    cancelMutation.mutate(cancelTargetId, {
      onSettled: () => setCancelTargetId(null),
    });
  };

  const selectedJob = selectedJobId
    ? jobs.find((j) => j.jobId === selectedJobId)
    : undefined;
  const selectedLive = selectedJobId ? liveJobs[selectedJobId] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card py-3 px-4 flex items-center gap-3">
          <Activity className="h-5 w-5 text-blue-400 shrink-0" aria-hidden />
          <div>
            <p className="text-xs text-dark-400">Aktive jobber</p>
            <p className="text-xl font-bold">{activeCount}</p>
          </div>
        </div>
        <div className="card py-3 px-4">
          <p className="text-xs text-dark-400">Kjører nå</p>
          <p className="text-xl font-bold text-blue-400">{statusCounts.running}</p>
        </div>
        <div className="card py-3 px-4">
          <p className="text-xs text-dark-400">Fullført</p>
          <p className="text-xl font-bold text-green-400">{statusCounts.completed}</p>
        </div>
        <div className="card py-3 px-4">
          <p className="text-xs text-dark-400">Feilet / avbrutt</p>
          <p className="text-xl font-bold text-dark-200">
            {statusCounts.failed + statusCounts.cancelled}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h3 className="font-semibold">Pipeline-jobber</h3>
            <p className="text-sm text-dark-400 mt-0.5">
              Streaming- og ingest-jobber med sanntidsfremdrift
            </p>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="btn-secondary text-sm inline-flex items-center gap-2 self-start"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
            Oppdater
          </button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Filtrer jobber">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={filter === opt.id}
              onClick={() => setFilter(opt.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === opt.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800/60 text-dark-400 hover:text-dark-200'
              }`}
            >
              {opt.label}
              {opt.id !== 'all' && statusCounts[opt.id as EtlJobStatus] > 0 && (
                <span className="ml-1.5 opacity-80">({statusCounts[opt.id as EtlJobStatus]})</span>
              )}
            </button>
          ))}
        </div>

        {isError ? (
          <QueryErrorBanner message="Kunne ikke laste ETL-jobber." onRetry={() => refetch()} />
        ) : isLoading && jobs.length === 0 ? (
          <ListSkeleton count={4} />
        ) : filteredJobs.length === 0 ? (
          <EmptyState
            title="Ingen jobber"
            description={
              filter === 'all'
                ? 'Start en streaming-ingest eller bulk-operasjon med jobbsporing for å se dem her.'
                : `Ingen jobber med status «${STATUS_LABELS[filter as EtlJobStatus] ?? filter}».`
            }
          />
        ) : (
          <div className="space-y-2">
            {filteredJobs.map((job) => {
              const display = mergeJob(job, liveJobs[job.jobId]);
              const expanded = selectedJobId === job.jobId;
              const isActive = display.status === 'running' || display.status === 'pending';

              return (
                <div
                  key={job.jobId}
                  className={`rounded-lg border transition-colors cursor-pointer ${
                    expanded
                      ? 'border-primary-600/50 bg-dark-800/80'
                      : 'border-dark-700/50 bg-dark-800/40 hover:bg-dark-800/60'
                  }`}
                  onClick={() => setSelectedJobId(expanded ? null : job.jobId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedJobId(expanded ? null : job.jobId);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expanded}
                >
                  <div className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <StatusIcon status={display.status} />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm" title={job.jobId}>
                              {truncateJobId(job.jobId)}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${STATUS_STYLES[display.status]}`}
                            >
                              {STATUS_LABELS[display.status]}
                            </span>
                          </div>
                          <p className="text-sm text-dark-300 mt-0.5 capitalize">
                            {display.table}
                            <span className="text-dark-500">
                              {' '}
                              · {SOURCE_LABELS[display.sourceType] ?? display.sourceType}
                            </span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right text-sm shrink-0">
                        <p className="text-dark-300">
                          {formatNumberNb(display.insertedRows)} innsatt
                        </p>
                        <p className="text-dark-500 text-xs">
                          {new Date(display.updatedAt).toLocaleString('nb-NO')}
                        </p>
                      </div>
                    </div>

                    {isActive && display.progressPercent !== null && !expanded && (
                      <div className="mt-3">
                        <ProgressBar percent={display.progressPercent} />
                      </div>
                    )}
                  </div>

                  {expanded && selectedJob && (
                    <div className="px-4 pb-4">
                      <JobDetail
                        job={selectedJob}
                        liveJob={selectedLive}
                        onCancel={() => setCancelTargetId(job.jobId)}
                        cancelling={
                          cancelMutation.isPending && cancelTargetId === job.jobId
                        }
                      />
                      {detailQuery.data?.lastFailure?.error_message && (
                        <p className="mt-2 text-xs text-amber-300/90 rounded bg-amber-900/20 px-3 py-2">
                          Siste feil: {detailQuery.data.lastFailure.error_message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!cancelTargetId}
        onClose={() => setCancelTargetId(null)}
        onConfirm={handleCancelConfirm}
        title="Avbryt ETL-jobb"
        confirmLabel="Avbryt jobb"
        intent="danger"
        loading={cancelMutation.isPending}
      >
        <p>
          Er du sikker på at du vil avbryte jobben{' '}
          <span className="font-mono text-sm">{cancelTargetId ? truncateJobId(cancelTargetId) : ''}</span>?
          Pågående import stoppes.
        </p>
      </ConfirmModal>
    </div>
  );
}
