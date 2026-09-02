/**
 * Post-commit side effects for order operations.
 *
 * Today these await audit + notifications directly (same delivery
 * guarantees as before). The indirection exists so a future outbox
 * migration only touches this file: replace `publish*` bodies with
 * `INSERT INTO outbox …` and add a relay worker — controllers and
 * services keep calling the same functions.
 *
 * @module services/orderEvents
 */
import { auditService } from './auditService.js';
import { notifyOrderStatusChange, notifyOrderSubmitted } from './notificationService.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { OrderWorkflowStatus } from '../lib/orderWorkflow.js';

export async function publishOrderStatusChanged(input: {
  req?: AuthRequest;
  ordrenr: number;
  kundenr: string;
  previousStatus: OrderWorkflowStatus;
  newStatus: OrderWorkflowStatus;
  changedBy?: string;
  auditEntityName?: string;
}): Promise<void> {
  if (input.req) {
    await auditService.logFromRequest({
      req: input.req,
      action: 'UPDATE',
      entityType: 'ordre',
      entityId: input.ordrenr,
      entityName: input.auditEntityName ?? `Status ${input.previousStatus} → ${input.newStatus}`,
      oldData: { workflow_status: input.previousStatus },
      newData: { workflow_status: input.newStatus },
    });
  }
  await notifyOrderStatusChange({
    ordrenr: input.ordrenr,
    kundenr: input.kundenr,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    changedBy: input.changedBy,
  });
}

export async function publishOrderSubmitted(input: {
  req: AuthRequest;
  created: {
    ordrenr: number;
    kundenr: string;
    workflow_status: string;
    sum: number;
    duplicate: boolean;
  };
  lineCount: number;
  submittedBy: string;
}): Promise<void> {
  await auditService.logFromRequest({
    req: input.req,
    action: 'CREATE',
    entityType: 'ordre',
    entityId: input.created.ordrenr,
    entityName: `Kundeordre ${input.created.ordrenr}`,
    newData: { ...input.created } as Record<string, unknown>,
  });

  if (!input.created.duplicate) {
    await notifyOrderSubmitted({
      ordrenr: input.created.ordrenr,
      kundenr: input.created.kundenr,
      sum: input.created.sum,
      lineCount: input.lineCount,
      submittedBy: input.submittedBy,
    });
  }
}
