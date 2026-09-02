/**
 * Write queries for the `ordre` workflow: status updates + owner cancel.
 *
 * Cancel is enforced in SQL (`workflow_status = ANY($2)` + optional
 * `kundenr = $3`) so there is no TOCTOU window between check and write.
 *
 * @module repositories/order/orderWriter
 */
import { query } from '../../db/index.js';
import {
  KUNDE_CANCELLABLE_STATUSES,
  type OrderWorkflowStatus,
} from '../../lib/orderWorkflow.js';

export interface OrderStatusRow {
  ordrenr: number;
  kundenr: string;
  workflow_status: OrderWorkflowStatus;
}

export async function updateOrderWorkflowStatus(
  ordrenr: number,
  workflowStatus: OrderWorkflowStatus,
): Promise<OrderStatusRow | null> {
  const result = await query(
    `UPDATE ordre
       SET workflow_status = $2, status_updated_at = NOW()
       WHERE ordrenr = $1
       RETURNING ordrenr, kundenr, workflow_status`,
    [ordrenr, workflowStatus],
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function getOrderWorkflowStatus(
  ordrenr: number,
): Promise<OrderWorkflowStatus | null> {
  const result = await query(`SELECT workflow_status FROM ordre WHERE ordrenr = $1`, [ordrenr]);
  return result.rows[0]?.workflow_status ?? null;
}

export async function cancelOrderByOwner(
  ordrenr: number,
  user: { role: string; kundenr?: string },
): Promise<OrderStatusRow | null> {
  let sql = `
      UPDATE ordre
      SET workflow_status = 'cancelled', status_updated_at = NOW()
      WHERE ordrenr = $1
        AND workflow_status = ANY($2::text[])
    `;
  const params: Array<number | string | readonly string[]> = [
    ordrenr,
    [...KUNDE_CANCELLABLE_STATUSES],
  ];

  if (user.role === 'kunde' && user.kundenr) {
    sql += ` AND kundenr = $3`;
    params.push(user.kundenr);
  }

  sql += ` RETURNING ordrenr, kundenr, workflow_status`;

  const result = await query(sql, params as unknown[]);
  return result.rows[0] ?? null;
}
