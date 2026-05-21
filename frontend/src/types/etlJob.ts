export type EtlJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export type EtlSourceType = 'csv' | 'json' | 'api' | 'generator';

export interface EtlPipelineJob {
  jobId: string;
  status: EtlJobStatus;
  table: string;
  sourceType: EtlSourceType;
  attemptedRows: number;
  insertedRows: number;
  rejectedRows: number;
  deadLetterCount: number;
  startedAt: string;
  updatedAt: string;
  error?: string;
  estimatedTotal?: number;
  progressPercent: number | null;
}

export interface EtlJobDetail extends EtlPipelineJob {
  lastFailure?: {
    error_message?: string | null;
    stage?: string;
    created_at?: string;
  };
}

export interface EtlJobsListResponse {
  jobs: EtlPipelineJob[];
}
