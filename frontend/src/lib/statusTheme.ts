/**
 * Phase 0 — central status theme (additive, no behavior change).
 *
 * Single home for success / danger / warning treatments plus the order
 * workflow palette from `lib/orderWorkflow.ts`. Importing this module
 * changes nothing on its own; later phases migrate the 4+ competing
 * success/danger treatments to these tokens.
 */

import { ORDER_WORKFLOW_STYLES } from './orderWorkflow';
import type { OrderWorkflowStatus } from './orderWorkflow';

/** Canonical success treatment (pick one — currently `green-400` family). */
export const STATUS_SUCCESS = 'text-green-400' as const;
/** Canonical danger treatment. */
export const STATUS_DANGER = 'text-red-400' as const;
/** Canonical warning treatment. */
export const STATUS_WARNING = 'text-yellow-400' as const;

/**
 * Workflow badge palette — re-exported so badge, timeline and filter
 * components share one map instead of each hardcoding colours.
 */
export const WORKFLOW_BADGE_STYLES: Record<OrderWorkflowStatus, string> =
  ORDER_WORKFLOW_STYLES;
