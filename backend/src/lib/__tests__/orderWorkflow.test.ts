/**
 * Active-order SQL filter must stay aligned with ORDER_WORKFLOW_TERMINAL_STATUSES.
 */
import {
  ORDER_WORKFLOW_TERMINAL_STATUSES,
  SQL_ACTIVE_ORDER_WHERE,
  KUNDE_CANCELLABLE_STATUSES,
  canTransition,
  getNextWorkflowStatuses,
} from '../orderWorkflow.js';

describe('orderWorkflow SQL constants', () => {
  it('SQL_ACTIVE_ORDER_WHERE includes all terminal statuses', () => {
    for (const status of ORDER_WORKFLOW_TERMINAL_STATUSES) {
      expect(SQL_ACTIVE_ORDER_WHERE).toContain(`'${status}'`);
    }
    expect(SQL_ACTIVE_ORDER_WHERE).toMatch(
      /^workflow_status NOT IN \('invoiced', 'cancelled', 'rejected'\)$/,
    );
  });
});

describe('customer approval workflow', () => {
  it('allows the full approval lifecycle', () => {
    expect(canTransition('pending_approval', 'approved')).toBe(true);
    expect(canTransition('pending_approval', 'rejected')).toBe(true);
    expect(canTransition('pending_approval', 'cancelled')).toBe(true);
    expect(canTransition('approved', 'processing')).toBe(true);
    expect(canTransition('approved', 'cancelled')).toBe(true);
  });

  it('rejects invalid approval jumps', () => {
    expect(canTransition('pending_approval', 'processing')).toBe(false);
    expect(canTransition('pending_approval', 'shipped')).toBe(false);
    expect(canTransition('approved', 'shipped')).toBe(false);
    expect(canTransition('rejected', 'approved')).toBe(false);
  });

  it('lets kunde cancel only before admin processing starts', () => {
    expect(KUNDE_CANCELLABLE_STATUSES).toEqual(['pending_approval', 'approved']);
    expect(KUNDE_CANCELLABLE_STATUSES).not.toContain('processing');
  });
});

describe('orderWorkflow transitions', () => {
  it('allows linear progression and cancellation', () => {
    expect(canTransition('new', 'processing')).toBe(true);
    expect(canTransition('processing', 'shipped')).toBe(true);
    expect(canTransition('shipped', 'invoiced')).toBe(true);
    expect(canTransition('new', 'cancelled')).toBe(true);
  });

  it('rejects invalid jumps', () => {
    expect(canTransition('new', 'invoiced')).toBe(false);
    expect(canTransition('invoiced', 'new')).toBe(false);
    expect(canTransition('cancelled', 'processing')).toBe(false);
  });

  it('returns next statuses from current state', () => {
    expect(getNextWorkflowStatuses('new')).toEqual(['processing', 'cancelled']);
    expect(getNextWorkflowStatuses('invoiced')).toEqual([]);
  });

  it('allows same-status no-op', () => {
    expect(canTransition('shipped', 'shipped')).toBe(true);
  });
});
