import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { orderModel, OrderFilters } from '../models/orderModel.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { buildListResponse } from '../lib/listResponse.js';
import {
  orderQuerySchema,
  updateOrderStatusSchema,
  createOrderSchema,
} from '../middleware/validation.js';
import {
  isOrderWorkflowStatus,
  canTransition,
  KUNDE_CANCELLABLE_STATUSES,
  ORDER_WORKFLOW_LABELS,
  type OrderWorkflowStatus,
} from '../lib/orderWorkflow.js';
import { notifyOrderStatusChange, notifyOrderSubmitted } from '../services/notificationService.js';
import { summarizeOrderLines } from '../lib/orderTotals.js';
import { orderPlacementService } from '../services/orderPlacementService.js';
import { auditService } from '../services/auditService.js';

export const orderController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const q = req.query as unknown as z.infer<typeof orderQuerySchema>;
    const { page, limit, sortBy, sortDir, startDate, endDate, kundenr, ordrenr, firmaid, lagernavn, search, q: searchQ, workflowStatus } = q;
    const offset = (page - 1) * limit;

    const filters: OrderFilters = {
      startDate,
      endDate,
      kundenr,
      ordrenr,
      firmaid,
      lagernavn,
      sortBy,
      sortDir,
      search: search ?? searchQ,
      workflowStatus,
    };

    const result = await orderModel.findAll(filters, req.user, { limit, offset });

    res.json(buildListResponse(result.data, { page, limit, total: result.total }));
  },

  getOne: async (req: AuthRequest, res: Response) => {
    const { ordrenr } = req.params;
    const order = await orderModel.findByOrderNr(Number(ordrenr), req.user);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

    const lines = await orderModel.findLines(Number(ordrenr));

    res.json({
      ...order,
      lines,
      lineSummary: summarizeOrderLines(lines),
    });
  },

  searchReferences: async (req: AuthRequest, res: Response) => {
    const { q } = req.query as { q: string };

    const orders = await orderModel.searchReferences(q, req.user);
    res.json(orders);
  },

  updateStatus: async (req: AuthRequest, res: Response) => {
    const { ordrenr } = req.params;
    const { workflowStatus } = req.body as z.infer<typeof updateOrderStatusSchema>;

    if (!isOrderWorkflowStatus(workflowStatus)) {
      throw new ValidationError('Invalid workflow status');
    }

    const existing = await orderModel.findByOrderNr(Number(ordrenr));
    if (!existing) {
      throw new NotFoundError('Order not found');
    }

    const previousStatus = (existing.workflow_status ?? 'new') as OrderWorkflowStatus;
    if (previousStatus === workflowStatus) {
      return res.json({ ordrenr: Number(ordrenr), workflow_status: workflowStatus });
    }

    if (!canTransition(previousStatus, workflowStatus)) {
      throw new ValidationError('Ugyldig statusovergang');
    }

    const updated = await orderModel.updateWorkflowStatus(Number(ordrenr), workflowStatus);
    if (!updated) {
      throw new NotFoundError('Order not found');
    }

    await notifyOrderStatusChange({
      ordrenr: Number(ordrenr),
      kundenr: updated.kundenr,
      previousStatus,
      newStatus: workflowStatus,
      changedBy: req.user?.username,
    });

    res.json({
      ordrenr: updated.ordrenr,
      workflow_status: updated.workflow_status,
      status_updated_at: new Date().toISOString(),
    });
  },

  listStatuses: async (_req: AuthRequest, res: Response) => {
    const { ORDER_WORKFLOW_STATUSES, ORDER_WORKFLOW_LABELS } = await import('../lib/orderWorkflow.js');
    res.json(
      ORDER_WORKFLOW_STATUSES.map((value) => ({
        value,
        label: ORDER_WORKFLOW_LABELS[value],
      })),
    );
  },

  /**
   * Create a customer order (kunde places an order from their cart).
   * Kundenr is taken from the JWT for kunde users; admins may place
   * orders on behalf of a customer via the optional body field.
   */
  create: async (req: AuthRequest, res: Response) => {
    const body = req.body as z.infer<typeof createOrderSchema>;
    const user = req.user!;

    let kundenr: string;
    if (user.role === 'kunde') {
      if (!user.kundenr) {
        throw new ValidationError('Brukeren mangler kundenummer');
      }
      kundenr = user.kundenr;
    } else {
      if (!body.kundenr) {
        throw new ValidationError('kundenr er påkrevd for administratorbestillinger');
      }
      kundenr = body.kundenr;
    }

    const created = await orderPlacementService.createOrder({
      kundenr,
      items: body.items,
      kundeordreref: body.kundeordreref,
      kunderef: body.kunderef,
      lagernavn: body.lagernavn,
      valutaid: body.valutaid,
      idempotencyKey: body.idempotencyKey,
    });

    // Post-commit side effects (audit never throws; notifications are awaited for delivery guarantees)
    await auditService.log({
      user: { id: user.id, username: user.username },
      action: 'CREATE',
      entityType: 'ordre',
      entityId: created.ordrenr,
      entityName: `Kundeordre ${created.ordrenr}`,
      newData: { ...created } as Record<string, unknown>,
      ipAddress: req.ip,
    });

    if (!created.duplicate) {
      await notifyOrderSubmitted({
        ordrenr: created.ordrenr,
        kundenr: created.kundenr,
        sum: created.sum,
        lineCount: body.items.length,
        submittedBy: user.username,
      });
    }

    res.status(created.duplicate ? 200 : 201).json(created);
  },

  /**
   * Cancel an order still awaiting approval.
   * Allowed for the owning kunde (from pending_approval/approved) and admins.
   */
  cancel: async (req: AuthRequest, res: Response) => {
    const ordrenr = Number(req.params.ordrenr);
    const user = req.user!;

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

    await auditService.log({
      user: { id: user.id, username: user.username },
      action: 'UPDATE',
      entityType: 'ordre',
      entityId: ordrenr,
      entityName: `Kansellert av ${user.role === 'kunde' ? 'kunde' : 'admin'}`,
      oldData: { workflow_status: previousStatus },
      newData: { workflow_status: 'cancelled' },
      ipAddress: req.ip,
    });

    await notifyOrderStatusChange({
      ordrenr,
      kundenr: cancelled.kundenr,
      previousStatus,
      newStatus: 'cancelled',
      changedBy: user.username,
    });

    res.json({
      ordrenr,
      workflow_status: cancelled.workflow_status,
      status_updated_at: new Date().toISOString(),
    });
  },
};
