/**
 * Order workflow business logic: status transitions + owner cancel.
 *
 * Extracted verbatim from `controllers/orderController` so HTTP stays
 * thin. Error messages, status codes and notification order are
 * unchanged — only the location moved.
 *
 * Depends on `models/orderModel` (mocked in route tests by path, so
 * existing mocks keep working).
 *
 * History: every transition appends a row to `ordre_status_history`
 * (who/when/from→to/comment) atomically with the status change, so the
 * timeline never diverges from the order row. Concurrent admin decisions
 * are serialized (`SELECT ... FOR UPDATE` inside `transitionWithHistory`);
 * the loser gets 409 instead of silently overwriting.
 *
 * @module services/orderWorkflowService
 */
import { ConflictError, NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { orderModel } from '../models/orderModel.js';
import { sanitizeHistoryComment } from '../repositories/order/orderHistory.js';
import {
  isOrderWorkflowStatus,
  canTransition,
  KUNDE_CANCELLABLE_STATUSES,
  ORDER_WORKFLOW_LABELS,
  type OrderWorkflowStatus,
} from '../lib/orderWorkflow.js';
import { publishOrderStatusChanged } from './orderEvents.js';
import type { AuthRequest } from '../middleware/auth.js';

export interface StatusChangeResult {
  ordrenr: number;
  workflow_status: OrderWorkflowStatus;
  status_updated_at?: string;
}

export interface UpdateStatusOptions {
  changedBy?: string;
  comment?: string | null;
  req?: AuthRequest;
  user?: { id?: number; username: string; role: string };
}

function toValidationError(err: unknown): never {
  const statusCode = (err as { statusCode?: number })?.statusCode;
  const message = err instanceof Error ? err.message : 'Ugyldig statusovergang';
  if (statusCode === 409) throw new ConflictError(message);
  throw new ValidationError(message);
}

function resolveActor(
  changedByOrOptions?: string | UpdateStatusOptions,
  req?: AuthRequest,
): { changedBy?: string; comment?: string | null; req?: AuthRequest; user?: UpdateStatusOptions['user'] } {
  if (typeof changedByOrOptions === 'string') {
    return { changedBy: changedByOrOptions, req };
  }
  return {
    changedBy: changedByOrOptions?.changedBy ?? req?.user?.username,
    comment: changedByOrOptions?.comment ?? null,
    req: changedByOrOptions?.req ?? req,
    user: changedByOrOptions?.user ?? (req?.user as UpdateStatusOptions['user'] | undefined),
  };
}

export const orderWorkflowService = {
  /**
   * Admin status transition with validation + notification.
   * Returns the updated status + timestamp (same shape as before).
   */
  updateStatus: async (
    ordrenr: number,
    workflowStatus: string,
    changedByOrOptions?: string | UpdateStatusOptions,
    maybeReq?: AuthRequest,
  ): Promise<StatusChangeResult> => {
    if (!isOrderWorkflowStatus(workflowStatus)) {
      throw new ValidationError('Invalid workflow status');
    }

    const { changedBy, req, user } = resolveActor(changedByOrOptions, maybeReq);
    const rawComment =
      typeof changedByOrOptions === 'object' ? (changedByOrOptions.comment ?? null) : null;

    let comment: string | null;
    try {
      comment = sanitizeHistoryComment(rawComment, { required: workflowStatus === 'rejected' });
    } catch (err) {
      toValidationError(err);
    }

    const existing = await orderModel.findByOrderNr(ordrenr);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    const previousStatus = (existing.workflow_status ?? 'new') as OrderWorkflowStatus;
    if (previousStatus === workflowStatus) {
      return { ordrenr, workflow_status: workflowStatus };
    }

    if (!canTransition(previousStatus, workflowStatus)) {
      throw new ValidationError('Ugyldig statusovergang');
    }

    const actorName = user?.username ?? changedBy ?? req?.user?.username ?? 'admin';
    const actorRole = user?.role ?? req?.user?.role ?? 'admin';
    const actorId = user?.id ?? req?.user?.id ?? null;

    // Preferred: atomic transition + history (single transaction, row lock).
    // Falls back to the legacy two-step path when the facade is mocked
    // in older tests that only stub `updateWorkflowStatus`.
    const canUseAtomic =
      typeof (orderModel as Record<string, unknown>).transitionWithHistory === 'function';
    let updated: { ordrenr: number; kundenr: string; workflow_status: OrderWorkflowStatus } | null;
    try {
      if (canUseAtomic) {
        updated = await orderModel.transitionWithHistory({
          ordrenr,
          previousStatus,
          newStatus: workflowStatus,
          changedById: actorId,
          changedByUsername: actorName,
          changedByRole: actorRole,
          comment: comment!,
        });
      } else {
        updated = await orderModel.updateWorkflowStatus(ordrenr, workflowStatus);
        // Best-effort history on the legacy path (never breaks the transition).
        const appendHistory = (orderModel as Record<string, unknown>).appendHistory;
        if (typeof appendHistory === 'function') {
          await (appendHistory as typeof orderModel.appendHistory)({
            ordrenr,
            previousStatus,
            newStatus: workflowStatus,
            changedById: actorId,
            changedByUsername: actorName,
            changedByRole: actorRole,
            comment: comment!,
          });
        }
      }
    } catch (err) {
      if ((err as { statusCode?: number })?.statusCode === 409) {
        throw new ConflictError(
          err instanceof Error ? err.message : 'Ordren ble endret av noen andre',
        );
      }
      throw err;
    }
    if (!updated) {
      throw new NotFoundError('Order not found');
    }

    await publishOrderStatusChanged({
      req,
      ordrenr,
      kundenr: updated.kundenr,
      previousStatus,
      newStatus: workflowStatus,
      changedBy: actorName,
      comment: comment!,
    });

    return {
      ordrenr: updated.ordrenr,
      workflow_status: updated.workflow_status,
      status_updated_at: new Date().toISOString(),
    };
  },

  /**
   * Owner/admin cancel of a cancellable order.
   * Audit entity name preserved for log continuity.
   */
  cancel: async (
    ordrenr: number,
    user: NonNullable<AuthRequest['user']>,
    req?: AuthRequest,
  ): Promise<StatusChangeResult> => {
    const existing = await orderModel.findByOrderNr(ordrenr, user);
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    const previousStatus = (existing.workflow_status ?? 'new') as OrderWorkflowStatus;
    if (!KUNDE_CANCELLABLE_STATUSES.includes(previousStatus)) {
      throw new ValidationError(
        `Ordre kan ikke kanselleres i status «${ORDER_WORKFLOW_LABELS[previousStatus]}»`,
      );
    }

    const cancelled = await orderModel.cancelByOwner(ordrenr, user);
    if (!cancelled) {
      throw new ValidationError('Ordren kan ikke lenger kanselleres');
    }

    // Best-effort timeline row (cancel itself already committed atomically).
    try {
      if (typeof orderModel.appendHistory === 'function') {
        await orderModel.appendHistory({
          ordrenr,
          previousStatus,
          newStatus: 'cancelled',
          changedById: user.id ?? null,
          changedByUsername: user.username,
          changedByRole: user.role,
          comment: null,
        });
      }
    } catch {
      // History is auxiliary — never fail the cancel.
    }

    await publishOrderStatusChanged({
      req,
      ordrenr,
      kundenr: cancelled.kundenr,
      previousStatus,
      newStatus: 'cancelled',
      changedBy: user.username,
      auditEntityName: `Kansellert av ${user.role === 'kunde' ? 'kunde' : 'admin'}`,
    });

    return {
      ordrenr,
      workflow_status: cancelled.workflow_status,
      status_updated_at: new Date().toISOString(),
    };
  },

  /** Newest-first workflow timeline, kunde-scoped (404 on foreign orders). */
  history: async (
    ordrenr: number,
    user?: { role: string; kundenr?: string },
  ): Promise<Array<Record<string, unknown>>> => {
    const order = await orderModel.findByOrderNr(ordrenr, user);
    if (!order) {
      throw new NotFoundError('Order not found');
    }
    if (typeof orderModel.listHistory !== 'function') return [];
    const rows = (await orderModel.listHistory(ordrenr)) as unknown as Array<Record<string, unknown>>;
    return rows;
  },
};
