import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { orderModel, OrderFilters } from '../models/orderModel.js';
import { NotFoundError, ValidationError } from '../middleware/errorHandler.js';
import { buildListResponse } from '../lib/listResponse.js';
import { orderQuerySchema, updateOrderStatusSchema } from '../middleware/validation.js';
import { isOrderWorkflowStatus, type OrderWorkflowStatus } from '../lib/orderWorkflow.js';
import { notifyOrderStatusChange } from '../services/notificationService.js';

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
};
