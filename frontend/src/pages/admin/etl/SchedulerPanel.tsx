import { ListSkeleton } from '../../../components/admin';
import { Job } from '../../../types/etl';

interface SchedulerPanelProps {
  jobs: Job[];
  isLoading: boolean;
  actionLoading: boolean;
  onRunJob: (jobId: string) => void;
  onToggleJob: (job: Job) => void;
}

export function SchedulerPanel({
  jobs,
  isLoading,
  actionLoading,
  onRunJob,
  onToggleJob,
}: SchedulerPanelProps) {
  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="font-semibold mb-4">Planlagte Jobber</h3>
        {isLoading && jobs.length === 0 ? (
          <ListSkeleton count={3} />
        ) : (
          <div className="space-y-3 stagger-fade-in">
            {jobs.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between bg-dark-800/50 p-4 rounded-lg transition-all duration-200 hover:bg-dark-800/80"
              >
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
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      job.status === 'running'
                        ? 'bg-blue-600/20 text-blue-400'
                        : job.status === 'error'
                          ? 'bg-red-600/20 text-red-400'
                          : 'bg-green-600/20 text-green-400'
                    }`}
                  >
                    {job.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRunJob(job.id)}
                    className="btn-secondary text-sm"
                    disabled={actionLoading}
                  >
                    Kjør Nå
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleJob(job)}
                    className={`text-sm ${job.enabled ? 'btn-danger' : 'btn-primary'}`}
                    disabled={actionLoading}
                  >
                    {job.enabled ? 'Stopp' : 'Start'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
