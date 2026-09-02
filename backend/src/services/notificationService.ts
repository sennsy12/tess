import type { EtlJobProgress } from '../etl/streaming/types.js';
import { ORDER_WORKFLOW_LABELS, type OrderWorkflowStatus } from '../lib/orderWorkflow.js';
import { notificationModel } from '../models/notificationModel.js';
import { deliverExternalAlert } from './alertDelivery.js';

/** Persist a notification and deliver an external alert in one call. */
async function createNotificationWithAlert(
  notificationInput: Parameters<typeof notificationModel.create>[0],
  alertMetadata?: Record<string, unknown>,
): Promise<void> {
  await notificationModel.create(notificationInput);
  deliverExternalAlert({
    type: notificationInput.type,
    title: notificationInput.title,
    message: notificationInput.message,
    metadata: alertMetadata ?? (notificationInput.metadata as Record<string, unknown>),
  });
}

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

  await createNotificationWithAlert({
    type: 'order_status',
    title,
    message: `Ordre #${input.ordrenr} (${input.kundenr}) satt til «${label}».`,
    metadata,
    audience: 'admin',
  });
}

/** Notify admins that a customer submitted a new order for approval. */
export async function notifyOrderSubmitted(input: {
  ordrenr: number;
  kundenr: string;
  sum?: number;
  lineCount?: number;
  submittedBy?: string;
}): Promise<void> {
  const title = `Ny ordre til godkjenning: #${input.ordrenr}`;
  const parts = [`Kunde ${input.kundenr} har sendt inn ordre #${input.ordrenr}.`];
  if (typeof input.lineCount === 'number') {
    parts.push(`${input.lineCount} linjer.`);
  }
  if (typeof input.sum === 'number') {
    parts.push(`Sum: ${input.sum.toLocaleString('nb-NO', { minimumFractionDigits: 2 })}`);
  }
  const message = parts.join(' ');
  const metadata = {
    ordrenr: input.ordrenr,
    kundenr: input.kundenr,
    newStatus: 'pending_approval',
    sum: input.sum,
    lineCount: input.lineCount,
    submittedBy: input.submittedBy,
  };

  await createNotificationWithAlert({
    type: 'order_submitted',
    title,
    message,
    metadata,
    audience: 'admin',
  });
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

  await createNotificationWithAlert({
    type: 'order_etl_refresh',
    title,
    message,
    metadata: { table: input.table, insertedRows: input.insertedRows, jobId: input.jobId },
    audience: 'admin',
  });
}

export async function notifyEtlJobFinished(job: EtlJobProgress): Promise<void> {
  if (job.status !== 'completed' && job.status !== 'failed') return;

  const failed = job.status === 'failed';
  const title = failed ? `ETL-jobb feilet: ${job.table}` : `ETL-jobb fullført: ${job.table}`;
  const message = failed
    ? job.error ?? 'Ukjent feil under ETL-kjøring.'
    : `${job.insertedRows.toLocaleString('nb-NO')} rader importert (${job.sourceType}).`;

  await createNotificationWithAlert(
    {
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
    },
    { jobId: job.jobId, table: job.table, status: job.status },
  );

  if (job.status === 'completed') {
    await notifyOrderDataRefresh({
      table: job.table,
      insertedRows: job.insertedRows,
      jobId: job.jobId,
    });
  }
}
