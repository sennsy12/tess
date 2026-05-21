import type { EtlJobProgress } from '../etl/streaming/types.js';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../lib/orderWorkflow.js';
import { notificationModel } from '../models/notificationModel.js';
import { deliverExternalAlert } from './alertDelivery.js';

export async function notifyOrderStatusChange(input: {
  ordrenr: number;
  kundenr: string;
  previousStatus: OrderWorkflowStatus;
  newStatus: OrderWorkflowStatus;
  changedBy?: string;
}): Promise<void> {
  const label = ORDER_WORKFLOW_LABELS[input.newStatus];
  const title = `Ordre #${input.ordrenr} oppdatert`;
  const message = `Status endret til «${label}».`;
  const metadata = {
    ordrenr: input.ordrenr,
    kundenr: input.kundenr,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    changedBy: input.changedBy,
  };

  await notificationModel.create({
    type: 'order_status',
    title,
    message,
    metadata,
    audience: 'kunde',
    kundenr: input.kundenr,
  });

  await notificationModel.create({
    type: 'order_status',
    title,
    message: `Ordre #${input.ordrenr} (${input.kundenr}) satt til «${label}».`,
    metadata,
    audience: 'admin',
  });

  deliverExternalAlert({ type: 'order_status', title, message, metadata });
}

export async function notifyOrderDataRefresh(input: {
  table: string;
  insertedRows: number;
  jobId?: string;
}): Promise<void> {
  if (input.table !== 'ordre' && input.table !== 'ordrelinje') return;
  if (input.insertedRows <= 0) return;

  const title = 'Ordredata oppdatert';
  const message =
    input.table === 'ordre'
      ? `${input.insertedRows.toLocaleString('nb-NO')} ordrer ble importert/oppdatert via ETL.`
      : `${input.insertedRows.toLocaleString('nb-NO')} ordrelinjer ble importert/oppdatert via ETL.`;

  await notificationModel.create({
    type: 'order_etl_refresh',
    title,
    message,
    metadata: { table: input.table, insertedRows: input.insertedRows, jobId: input.jobId },
    audience: 'admin',
  });

  deliverExternalAlert({
    type: 'order_etl_refresh',
    title,
    message,
    metadata: { table: input.table, insertedRows: input.insertedRows, jobId: input.jobId },
  });
}

export async function notifyEtlJobFinished(job: EtlJobProgress): Promise<void> {
  if (job.status !== 'completed' && job.status !== 'failed') return;

  const failed = job.status === 'failed';
  const title = failed ? `ETL-jobb feilet: ${job.table}` : `ETL-jobb fullført: ${job.table}`;
  const message = failed
    ? job.error ?? 'Ukjent feil under ETL-kjøring.'
    : `${job.insertedRows.toLocaleString('nb-NO')} rader importert (${job.sourceType}).`;

  await notificationModel.create({
    type: failed ? 'etl_failed' : 'etl_completed',
    title,
    message,
    metadata: {
      jobId: job.jobId,
      table: job.table,
      status: job.status,
      insertedRows: job.insertedRows,
      rejectedRows: job.rejectedRows,
      error: job.error,
    },
    audience: 'admin',
  });

  deliverExternalAlert({
    type: failed ? 'etl_failed' : 'etl_completed',
    title,
    message,
    metadata: { jobId: job.jobId, table: job.table, status: job.status },
  });

  if (job.status === 'completed') {
    await notifyOrderDataRefresh({
      table: job.table,
      insertedRows: job.insertedRows,
      jobId: job.jobId,
    });
  }
}
