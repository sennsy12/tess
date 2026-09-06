import { z } from 'zod';

// Helper to convert empty strings to undefined
export const emptyToUndefined = (v: string | undefined) => v && v.trim() ? v : undefined;

// ============================================================
// Common validation schemas
// ============================================================

// Pagination
export const paginationSchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1', 10) || 1)),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '50', 10) || 50))),
});

export const sortQuerySchema = z.object({
  sortBy: z.string().optional().transform(emptyToUndefined),
  sortDir: z.enum(['asc', 'desc']).optional(),
});

// Date range - allows empty strings (treated as undefined)
export const dateRangeSchema = z.object({
  startDate: z.string().optional().transform(v => v && v.trim() ? v : undefined).pipe(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional()
  ),
  endDate: z.string().optional().transform(v => v && v.trim() ? v : undefined).pipe(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional()
  ),
});

// Statistics queries
export const statisticsQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  varegruppe: z.string().optional().transform(emptyToUndefined),
  kundenr: z.string().optional().transform(emptyToUndefined),
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
});

export const statisticsSummarySchema = dateRangeSchema;

export const statisticsTimeSeriesSchema = dateRangeSchema.extend({
  groupBy: z.enum(['day', 'week', 'month', 'year']).optional(),
});

export const statisticsCustomSchema = dateRangeSchema.extend({
  metric: z.enum(['sum', 'count', 'quantity']),
  dimension: z.enum(['day', 'month', 'year', 'product', 'category']),
  kundenr: z.string().optional().transform(emptyToUndefined),
});

// ID params — coerce handles Express string params (`"5"` → `5`) and yields
// a proper ZodError (→ ValidationError 400 via validate()) for NaN/negative.
// NOTE: previously a throwing transform produced a generic Error → 500;
// success-path behaviour (numeric string → number) is unchanged.
export const idParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
