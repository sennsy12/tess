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
};
