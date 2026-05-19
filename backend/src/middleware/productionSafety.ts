import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from './errorHandler.js';

const WEAK_ADMIN_KEYS = new Set(['123', 'admin', 'password', 'changeme']);

/**
 * Whether destructive ETL operations (truncate, createDB, test pipelines) are allowed.
 * Default: enabled in non-production, disabled in production unless explicitly enabled.
 */
export function isDestructiveEtlEnabled(): boolean {
  const flag = process.env.ENABLE_DESTRUCTIVE_ETL;
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Whether default scheduler jobs (test data refresh, DB cleanup) may be registered/started.
 */
export function isSchedulerJobsEnabled(): boolean {
  const flag = process.env.ENABLE_SCHEDULER_JOBS;
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  return process.env.NODE_ENV !== 'production';
}

/**
 * Block destructive ETL routes when disabled (production default).
 */
export function requireDestructiveEtl(req: Request, _res: Response, next: NextFunction) {
  if (!isDestructiveEtlEnabled()) {
    return next(
      new ForbiddenError(
        'Destructive ETL operations are disabled. Set ENABLE_DESTRUCTIVE_ETL=true only in controlled environments.'
      )
    );
  }
  next();
}

/**
 * Validate ADMIN_ACTION_KEY strength (used from env.ts at startup).
 */
export function assertAdminActionKeyStrength(key: string): void {
  if (key.length < 16) {
    throw new Error('CRITICAL: ADMIN_ACTION_KEY must be at least 16 characters in production');
  }
  if (WEAK_ADMIN_KEYS.has(key.toLowerCase())) {
    throw new Error('CRITICAL: ADMIN_ACTION_KEY is a known weak value; use a strong random secret');
  }
}
