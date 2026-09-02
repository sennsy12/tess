/**
 * Unit tests for the pure order-filter SQL builder.
 */
import { ORDER_LIST_BASE_SQL, applyOrderFilters } from '../orderFilters';

describe('applyOrderFilters', () => {
  it('kunde scope wins over the kundenr filter', () => {
    const params: Array<string | number | null> = [];
    const { sql } = applyOrderFilters(
      ORDER_LIST_BASE_SQL,
      params,
      { kundenr: 'K2' },
      { role: 'kunde', kundenr: 'K1' },
    );
    expect(sql).toContain('o.kundenr = $1');
    expect(params).toEqual(['K1']);
  });

  it('builds date + status + search filters with sequential indexes', () => {
    const params: Array<string | number | null> = [];
    const { sql, nextIndex } = applyOrderFilters(
      ORDER_LIST_BASE_SQL,
      params,
      { startDate: '2024-01-01', workflowStatus: 'approved', search: 'acme' },
      { role: 'admin' },
    );
    expect(sql).toContain('o.dato >=');
    expect(sql).toContain('o.workflow_status =');
    expect(sql).toContain('ILIKE');
    expect(params).toEqual(['2024-01-01', 'approved', '%acme%']);
    expect(nextIndex).toBe(params.length + 1);
  });

  it('emits no clauses for empty filters', () => {
    const params: Array<string | number | null> = [];
    const { sql } = applyOrderFilters(ORDER_LIST_BASE_SQL, params, {}, undefined);
    expect(sql).toBe(ORDER_LIST_BASE_SQL);
    expect(params).toEqual([]);
  });
});
