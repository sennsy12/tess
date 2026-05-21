/**
 * Active-order SQL filter must stay aligned with ORDER_WORKFLOW_TERMINAL_STATUSES.
 */
import {
  ORDER_WORKFLOW_TERMINAL_STATUSES,
  SQL_ACTIVE_ORDER_WHERE,
} from '../orderWorkflow.js';

describe('orderWorkflow SQL constants', () => {
  it('SQL_ACTIVE_ORDER_WHERE includes all terminal statuses', () => {
    for (const status of ORDER_WORKFLOW_TERMINAL_STATUSES) {
      expect(SQL_ACTIVE_ORDER_WHERE).toContain(`'${status}'`);
    }
    expect(SQL_ACTIVE_ORDER_WHERE).toMatch(
      /^workflow_status NOT IN \('invoiced', 'cancelled'\)$/,
    );
  });
});
