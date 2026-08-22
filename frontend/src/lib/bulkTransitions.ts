import { canTransition, type OrderWorkflowStatus } from './orderWorkflow';

export const BULK_CONCURRENCY = 4;

export interface BulkRow {
  ordrenr: number;
  workflow_status?: string | null;
}

export interface BulkPartition<T extends BulkRow> {
  eligible: T[];
  ineligible: T[];
}

/** Splits selected orders into rows that may legally move to the target status and rows that cannot. */
export function partitionByLegalTransition<T extends BulkRow>(
  rows: T[],
  target: OrderWorkflowStatus,
): BulkPartition<T> {
  const eligible: T[] = [];
  const ineligible: T[] = [];
  for (const row of rows) {
    const from = (row.workflow_status ?? 'new') as OrderWorkflowStatus;
    if (canTransition(from, target)) {
      eligible.push(row);
    } else {
      ineligible.push(row);
    }
  }
  return { eligible, ineligible };
}

export interface BulkFailure {
  ordrenr: number;
  message: string;
}

export interface BulkRunResult {
  succeeded: number[];
  failed: BulkFailure[];
}

type UpdateFn = (ordrenr: number, workflowStatus: string) => Promise<unknown>;

function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object' && 'error' in data && data.error) {
      return String((data as { error: unknown }).error);
    }
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Ukjent feil';
}

/**
 * Runs a status update for every order with bounded concurrency.
 * Each order is attempted exactly once; failures are collected, not thrown.
 */
export async function executeBulkStatusUpdate(
  ordrenrList: number[],
  workflowStatus: OrderWorkflowStatus,
  updateFn: UpdateFn,
  concurrency: number = BULK_CONCURRENCY,
): Promise<BulkRunResult> {
  const succeeded: number[] = [];
  const failed: BulkFailure[] = [];

  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < ordrenrList.length) {
      const ordrenr = ordrenrList[cursor];
      cursor += 1;
      try {
        await updateFn(ordrenr, workflowStatus);
        succeeded.push(ordrenr);
      } catch (err) {
        failed.push({ ordrenr, message: extractErrorMessage(err) });
      }
    }
  };

  if (ordrenrList.length > 0) {
    await Promise.all(
      Array.from({ length: Math.min(concurrency, ordrenrList.length) }, () => worker()),
    );
  }

  succeeded.sort((a, b) => a - b);
  failed.sort((a, b) => a.ordrenr - b.ordrenr);
  return { succeeded, failed };
}

export type WaitingAgeLevel = 'ok' | 'warn' | 'danger';

export interface WaitingAge {
  label: string;
  level: WaitingAgeLevel;
}

const HOUR_MS = 3_600_000;
export const AGE_WARN_HOURS = 48;
export const AGE_DANGER_HOURS = 24 * 7;

/** Human label for how long an order has waited in its current status ("5 t", "3 d"). */
export function waitingAgeLabel(dato: string | Date, now: Date = new Date()): WaitingAge {
  const then = dato instanceof Date ? dato : new Date(dato);
  const elapsedMs = now.getTime() - then.getTime();
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) {
    return { label: '0 t', level: 'ok' };
  }

  const hours = Math.floor(elapsedMs / HOUR_MS);
  const days = Math.floor(hours / 24);

  let level: WaitingAgeLevel = 'ok';
  if (hours >= AGE_DANGER_HOURS) level = 'danger';
  else if (hours >= AGE_WARN_HOURS) level = 'warn';

  return { label: hours >= 24 ? `${days} d` : `${hours} t`, level };
}
