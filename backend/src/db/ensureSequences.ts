/**
 * Sequence self-healing for `ordre_customer_seq`.
 *
 * Background: customer-placed orders take their `ordrenr` from
 * `nextval('ordre_customer_seq')` (orderPlacementService), while bulk ETL
 * imports historical orders with explicit high `ordrenr` values. Migration
 * 008 only buffered the sequence once (+10000 at migration time), so a later
 * ETL import can overtake the sequence and the next customer order fails
 * with a duplicate-key error.
 *
 * `ensureOrderCustomerSeq` re-raises the sequence floor above
 * `MAX(ordre.ordrenr)` when needed — and NEVER lowers it:
 * `setval(seq, GREATEST(MAX(ordrenr), current last_value), true)`.
 * Deliberately uses `last_value` (not `nextval`) so the check itself burns
 * no sequence values and creates no gaps.
 *
 * Safe to call anywhere, anytime: no-op when the sequence already leads,
 * no-op (returns 'missing') before migration 008 has run, and never throws
 * (returns 'failed' + warns instead) so callers can fire-and-forget it.
 *
 * @module db/ensureSequences
 */
import pool from './pool.js';
import { dbLogger } from '../lib/logger.js';

export const ORDRE_CUSTOMER_SEQ = 'public.ordre_customer_seq';

export type EnsureSequenceStatus = 'ok' | 'missing' | 'failed';

export async function ensureOrderCustomerSeq(): Promise<EnsureSequenceStatus> {
  try {
    const exists = await pool.query(
      `SELECT to_regclass('${ORDRE_CUSTOMER_SEQ}') AS reg`,
    );
    if (!exists.rows[0]?.reg) {
      return 'missing';
    }
    await pool.query(`
      SELECT setval(
        '${ORDRE_CUSTOMER_SEQ}',
        (SELECT GREATEST(
          COALESCE(MAX(ordrenr), 0),
          COALESCE((SELECT last_value FROM ${ORDRE_CUSTOMER_SEQ}), 0)
        ) FROM public.ordre),
        true
      )
    `);
    return 'ok';
  } catch (err) {
    dbLogger.warn({ err }, 'ensureOrderCustomerSeq failed (best-effort, ETL data untouched)');
    return 'failed';
  }
}
