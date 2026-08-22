import { describe, expect, it, vi } from 'vitest';
import {
  BULK_CONCURRENCY,
  executeBulkStatusUpdate,
  partitionByLegalTransition,
  waitingAgeLabel,
} from '../bulkTransitions';
import type { BulkRow } from '../bulkTransitions';

const row = (ordrenr: number, workflow_status?: string | null): BulkRow => ({
  ordrenr,
  workflow_status,
});

describe('partitionByLegalTransition', () => {
  it('keeps orders whose current status may move to the target', () => {
    const rows = [
      row(1, 'pending_approval'),
      row(2, 'pending_approval'),
      row(3, 'rejected'),
      row(4, 'invoiced'),
    ];

    const { eligible, ineligible } = partitionByLegalTransition(rows, 'approved');

    expect(eligible.map((r) => r.ordrenr)).toEqual([1, 2]);
    expect(ineligible.map((r) => r.ordrenr)).toEqual([3, 4]);
  });

  it('treats a missing status as new', () => {
    const { eligible, ineligible } = partitionByLegalTransition(
      [row(1), row(2, null)],
      'processing',
    );

    expect(eligible).toHaveLength(2);
    expect(ineligible).toHaveLength(0);
  });

  it('allows same-status targets (idempotent re-send)', () => {
    const { eligible } = partitionByLegalTransition([row(1, 'approved')], 'approved');

    expect(eligible).toHaveLength(1);
  });
});

describe('executeBulkStatusUpdate', () => {
  it('reports every order exactly once across successes and failures', async () => {
    const updateFn = vi.fn((ordrenr: number) =>
      ordrenr === 3 ? Promise.reject(new Error('Ugyldig overgang')) : Promise.resolve({}),
    );

    const result = await executeBulkStatusUpdate([1, 2, 3, 4], 'approved', updateFn);

    expect(updateFn).toHaveBeenCalledTimes(4);
    expect(result.succeeded).toEqual([1, 2, 4]);
    expect(result.failed).toEqual([{ ordrenr: 3, message: 'Ugyldig overgang' }]);
  });

  it('never exceeds the concurrency limit and processes everything', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    const updateFn = async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
    };

    const ordrenrList = Array.from({ length: 20 }, (_, i) => i + 1);
    const result = await executeBulkStatusUpdate(ordrenrList, 'processing', updateFn);

    expect(maxInFlight).toBeLessThanOrEqual(BULK_CONCURRENCY);
    expect(result.succeeded).toHaveLength(20);
    expect(result.failed).toHaveLength(0);
    expect(result.succeeded).toEqual([...result.succeeded].sort((a, b) => a - b));
  }, 10_000);

  it('extracts the backend error message from axios-style failures', async () => {
    const updateFn = vi.fn(() =>
      Promise.reject({
        response: { data: { error: 'Ordren er allerede kansellert' } },
      }),
    );

    const result = await executeBulkStatusUpdate([7], 'cancelled', updateFn);

    expect(result.failed[0]).toEqual({ ordrenr: 7, message: 'Ordren er allerede kansellert' });
  });

  it('resolves immediately for an empty selection', async () => {
    const updateFn = vi.fn();

    const result = await executeBulkStatusUpdate([], 'approved', updateFn);

    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(updateFn).not.toHaveBeenCalled();
  });
});

describe('waitingAgeLabel', () => {
  const now = new Date('2026-08-22T12:00:00Z');

  it('formats hours below a day and days above it', () => {
    expect(waitingAgeLabel(new Date(now.getTime() - 30 * 60_000), now)).toMatchObject({
      label: '0 t',
      level: 'ok',
    });
    expect(waitingAgeLabel(new Date(now.getTime() - 5 * 3_600_000), now)).toMatchObject({
      label: '5 t',
      level: 'ok',
    });
    expect(waitingAgeLabel(new Date(now.getTime() - 50 * 3_600_000), now)).toMatchObject({
      label: '2 d',
      level: 'warn',
    });
    expect(waitingAgeLabel(new Date(now.getTime() - 8 * 24 * 3_600_000), now)).toMatchObject({
      label: '8 d',
      level: 'danger',
    });
  });

  it('handles invalid or future dates without throwing', () => {
    expect(waitingAgeLabel('', now)).toEqual({ label: '0 t', level: 'ok' });
    expect(waitingAgeLabel(new Date(now.getTime() + 60_000), now)).toEqual({
      label: '0 t',
      level: 'ok',
    });
  });
});
