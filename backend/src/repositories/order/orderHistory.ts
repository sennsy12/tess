/**
 * Read/write queries for the `ordre_status_history` timeline table.
 *
 * Dedicated history (who/when/from→to/comment) for the order workflow.
 * The generic `audit_log` stays untouched — it is best-effort and has no
 * comment field, so it cannot serve as the timeline source of truth.
 *
 * @module repositories/order/orderHistory
 */
import { query, transaction } from '../../db/index.js';
import type { PoolClient } from 'pg';
import type { OrderWorkflowStatus } from '../../lib/orderWorkflow.js';

export interface OrderHistoryEntry {
  id: number;
  ordrenr: number;
  previous_status: OrderWorkflowStatus | null;
  new_status: OrderWorkflowStatus;
  changed_by_id: number | null;
  changed_by_username: string;
  changed_by_role: string;
  comment: string | null;
  created_at: string;
}

export interface InsertHistoryInput {
  ordrenr: number;
  previousStatus: OrderWorkflowStatus | null;
  newStatus: OrderWorkflowStatus;
  changedById?: number | null;
  changedByUsername: string;
  changedByRole: string;
  comment?: string | null;
}

type Executor = { query: PoolClient['query'] };

/**
 * Sanitize a user-supplied workflow comment.
 * Returns null when empty after trimming. Throws ValidationError-shaped
 * Error with `statusCode = 400` so services can rethrow as ValidationError.
 */
export function sanitizeHistoryComment(raw: unknown, opts?: { required?: boolean }): string | null {
  if (raw === undefined || raw === null) {
    if (opts?.required) {
      const err = new Error('Begrunnelse er påkrevd ved avvisning') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    return null;
  }
  if (typeof raw !== 'string') {
    const err = new Error('Ugyldig kommentar') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  // Strip HTML tags, collapse whitespace/control chars, trim.
  const stripped = raw
    .replace(/<[^>]*>/g, '')
    .replace(/[^\S ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!stripped) {
    if (opts?.required) {
      const err = new Error('Begrunnelse er påkrevd ved avvisning') as Error & { statusCode?: number };
      err.statusCode = 400;
      throw err;
    }
    return null;
  }
  if (stripped.length > 500) {
    const err = new Error('Kommentar kan være maks 500 tegn') as Error & { statusCode?: number };
    err.statusCode = 400;
    throw err;
  }
  return stripped;
}

export async function insertOrderHistory(
  executor: Executor,
  input: InsertHistoryInput,
): Promise<OrderHistoryEntry> {
  const result = await executor.query(
    `INSERT INTO ordre_status_history
       (ordrenr, previous_status, new_status, changed_by_id, changed_by_username, changed_by_role, comment)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.ordrenr,
      input.previousStatus,
      input.newStatus,
      input.changedById ?? null,
      input.changedByUsername,
      input.changedByRole,
      input.comment ?? null,
    ],
  );
  return result.rows[0];
}

const HISTORY_SELECT = `
  SELECT id, ordrenr, previous_status, new_status,
         changed_by_id, changed_by_username, changed_by_role,
         comment, created_at
  FROM ordre_status_history
  WHERE ordrenr = $1
  ORDER BY created_at DESC, id DESC
  LIMIT $2
`;

/** Newest-first history for one order (capped, timeline never needs more). */
export async function listOrderHistory(
  ordrenr: number,
  limit = 100,
): Promise<OrderHistoryEntry[]> {
  const capped = Math.min(200, Math.max(1, Math.floor(limit) || 100));
  try {
    const result = await query(HISTORY_SELECT, [ordrenr, capped]);
    return result.rows;
  } catch (err: unknown) {
    // Table missing on DBs that haven't migrated yet → empty timeline, not 500.
    // `42P01` = undefined_table.
    if ((err as { code?: string })?.code === '42P01') return [];
    throw err;
  }
}

/**
 * Atomically transition workflow status + append history in ONE transaction.
 *
 * Uses `SELECT ... FOR UPDATE` to serialize concurrent admin decisions
 * (fixes the previous TOCTOU: find → check → unconditional UPDATE where
 * last-writer-wins). Returns null when the order does not exist.
 */
export async function transitionWithHistory(input: {
  ordrenr: number;
  previousStatus: OrderWorkflowStatus;
  newStatus: OrderWorkflowStatus;
  changedById?: number | null;
  changedByUsername: string;
  changedByRole: string;
  comment?: string | null;
}): Promise<{ ordrenr: number; kundenr: string; workflow_status: OrderWorkflowStatus } | null> {
  return transaction(async (client) => {
    const locked = await client.query(
      `SELECT ordrenr, kundenr, workflow_status FROM ordre WHERE ordrenr = $1 FOR UPDATE`,
      [input.ordrenr],
    );
    if (locked.rows.length === 0) return null;
    const current = locked.rows[0].workflow_status as OrderWorkflowStatus;
    // Re-check under lock: another admin may have moved it since the service read.
    if (current !== input.previousStatus) {
      const err = new Error(
        'Ordren ble endret av noen andre — last inn på nytt',
      ) as Error & { statusCode?: number };
      err.statusCode = 409;
      throw err;
    }
    const updated = await client.query(
      `UPDATE ordre
         SET workflow_status = $2, status_updated_at = NOW()
         WHERE ordrenr = $1
         RETURNING ordrenr, kundenr, workflow_status`,
      [input.ordrenr, input.newStatus],
    );
    await insertOrderHistory(client, {
      ordrenr: input.ordrenr,
      previousStatus: input.previousStatus,
      newStatus: input.newStatus,
      changedById: input.changedById ?? null,
      changedByUsername: input.changedByUsername,
      changedByRole: input.changedByRole,
      comment: input.comment ?? null,
    });
    return updated.rows[0];
  });
}
