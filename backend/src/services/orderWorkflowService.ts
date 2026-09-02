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
 * @module services/orderWorkflowService
 */
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { orderModel } from '../models/orderModel.js';
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

export const orderWorkflowService = {
  /**
   * Admin status transition with validation + notification.
   * Returns the updated status + timestamp (same shape as before).
   */
  updateStatus: async (
    ordrenr: number,
    workflowStatus: string,
    changedBy?: string,
  ): Promise<StatusChangeResult> => {
    if (!isOrderWorkflowStatus(workflowStatus)) {
      throw new ValidationError('Invalid workflow status');
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

    const updated = await orderModel.updateWorkflowStatus(ordrenr, workflowStatus);
    if (!updated) {
      throw new NotFoundError('Order not found');
    }

    await publishOrderStatusChanged({
      ordrenr,
      kundenr: updated.kundenr,
      previousStatus,
      newStatus: workflowStatus,
      changedBy,
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
};
