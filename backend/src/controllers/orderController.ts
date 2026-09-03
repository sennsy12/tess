import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth.js';
import { orderModel, OrderFilters } from '../models/orderModel.js';
import { NotFoundError } from '../middleware/errorHandler.js';
import { buildListResponse } from '../lib/listResponse.js';
import {
  orderQuerySchema,
  updateOrderStatusSchema,
  createOrderSchema,
} from '../middleware/validation.js';
import { parsePagination } from '../http/pagination.js';
import { resolveOrderKundenr } from '../http/ownership.js';
import { summarizeOrderLines } from '../lib/orderTotals.js';
import { orderPlacementService } from '../services/orderPlacementService.js';
import { orderWorkflowService } from '../services/orderWorkflowService.js';
import { publishOrderSubmitted } from '../services/orderEvents.js';

export const orderController = {
  getAll: async (req: AuthRequest, res: Response) => {
    const q = req.query as unknown as z.infer<typeof orderQuerySchema>;
    const { sortBy, sortDir, startDate, endDate, kundenr, ordrenr, firmaid, lagernavn, search, q: searchQ, workflowStatus } = q;
    const { page, limit, offset } = parsePagination(
      q as unknown as Record<string, unknown>,
      { page: q.page, limit: q.limit },
    );

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
    const [order, lines] = await Promise.all([
      orderModel.findByOrderNr(Number(ordrenr), req.user),
      orderModel.findLines(Number(ordrenr)),
    ]);

    if (!order) {
      throw new NotFoundError('Order not found');
    }

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
    const { workflowStatus, comment } = req.body as z.infer<typeof updateOrderStatusSchema>;

    const result = await orderWorkflowService.updateStatus(
      Number(ordrenr),
      workflowStatus,
      { comment: comment ?? null, req, user: req.user },
    );
    res.json(result);
  },

  getHistory: async (req: AuthRequest, res: Response) => {
    const { ordrenr } = req.params;
    const history = await orderWorkflowService.history(Number(ordrenr), req.user);
    res.json({ data: history });
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

    const kundenr = resolveOrderKundenr(user, body.kundenr);

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
    await publishOrderSubmitted({
      req,
      created,
      lineCount: body.items.length,
      submittedBy: user.username,
    });

    res.status(created.duplicate ? 200 : 201).json(created);
  },

  /**
   * Cancel an order still awaiting approval.
   * Allowed for the owning kunde (from pending_approval/approved) and admins.
   */
  cancel: async (req: AuthRequest, res: Response) => {
    const ordrenr = Number(req.params.ordrenr);
    const user = req.user!;

    const result = await orderWorkflowService.cancel(ordrenr, user, req);
    res.json(result);
  },
};
