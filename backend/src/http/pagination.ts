/**
 * Shared pagination parser for list endpoints.
 *
 * Single source of truth so `?page=abc`, `?limit=-5` and `?limit=1000000`
 * behave identically everywhere: invalid values fall back to defaults,
 * limits are clamped to block runaway scans.
 *
 * @module http/pagination
 */

export interface ParsedPagination {
  page: number;
  limit: number;
  offset: number;
}

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

function toPositiveInt(value: unknown, fallback: number): number {
  const n = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

/**
 * Parse `req.query`-style pagination params with clamping.
 *
 * @param q - query object (e.g. `req.query`)
 * @param defaults - optional `{ page, limit }` overrides
 */
export function parsePagination(
  q: Record<string, unknown>,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): ParsedPagination {
  const maxLimit = defaults.maxLimit ?? MAX_LIMIT;
  const page = Math.max(1, toPositiveInt(q.page, defaults.page ?? DEFAULT_PAGE));
  const rawLimit = toPositiveInt(q.limit, defaults.limit ?? DEFAULT_LIMIT);
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  return { page, limit, offset: (page - 1) * limit };
}
