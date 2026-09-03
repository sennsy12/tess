/**
 * Order Model (facade).
 *
 * Implementation lives in `repositories/order/*` (finder / writer / search /
 * filters) so each file stays small and unit-testable. This module keeps the
 * historic `orderModel` import path stable for controllers and tests.
 *
 * @module models/orderModel
 */
import { findOrders, findOrderByNumber, findOrderLines } from '../repositories/order/orderFinder.js';
import {
  updateOrderWorkflowStatus,
  getOrderWorkflowStatus,
  cancelOrderByOwner,
} from '../repositories/order/orderWriter.js';
import {
  listOrderHistory,
  transitionWithHistory,
  insertOrderHistory,
} from '../repositories/order/orderHistory.js';
import { searchOrdersByReference } from '../repositories/order/orderSearch.js';
import type { OrderWorkflowStatus } from '../lib/orderWorkflow.js';

/** Filter parameters accepted by `findAll`. */
export interface OrderFilters {
  kundenr?: string;
  ordrenr?: string;
  startDate?: string;
  endDate?: string;
  firmaid?: number;
  lagernavn?: string;
  valutaid?: string;
  search?: string;
  workflowStatus?: OrderWorkflowStatus;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export const orderModel = {
  findAll: (
    filters: OrderFilters,
    user?: { role: string; kundenr?: string },
    pagination?: { limit: number; offset: number },
  ) => findOrders(filters, user, pagination),

  findByOrderNr: (ordrenr: number, user?: { role: string; kundenr?: string }) =>
    findOrderByNumber(ordrenr, user),

  findLines: (ordrenr: number) => findOrderLines(ordrenr),

  searchReferences: (q: string, user?: { role: string; kundenr?: string }) =>
    searchOrdersByReference(q, user),

  updateWorkflowStatus: (ordrenr: number, workflowStatus: OrderWorkflowStatus) =>
    updateOrderWorkflowStatus(ordrenr, workflowStatus),

  getWorkflowStatus: (ordrenr: number) => getOrderWorkflowStatus(ordrenr),

  cancelByOwner: (ordrenr: number, user: { role: string; kundenr?: string }) =>
    cancelOrderByOwner(ordrenr, user),

  /** Atomic status transition + history append (preferred over updateWorkflowStatus). */
  transitionWithHistory: (input: Parameters<typeof transitionWithHistory>[0]) =>
    transitionWithHistory(input),

  /** Newest-first workflow timeline for one order. */
  listHistory: (ordrenr: number, limit?: number) => listOrderHistory(ordrenr, limit),

  /** Best-effort history insert (e.g. after owner cancel). Never throws the caller. */
  appendHistory: async (input: Parameters<typeof insertOrderHistory>[1]): Promise<void> => {
    const { transaction } = await import('../db/index.js');
    try {
      await transaction(async (client) => {
        await insertOrderHistory(client, input);
      });
    } catch {
      // History is auxiliary — the status change itself already committed.
    }
  },
};
