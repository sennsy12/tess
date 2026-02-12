import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError, ZodIssue } from 'zod';
import { ValidationError } from './errorHandler.js';

/**
 * Validation middleware factory
 * Creates middleware that validates request body, query, or params against a Zod schema
 */
export const validate = <T extends ZodSchema>(
  schema: T,
  source: 'body' | 'query' | 'params' = 'body'
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      // Replace with validated/transformed data
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const messages = error.issues.map((e: ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
        throw new ValidationError(`Validation failed: ${messages}`);
      }
      throw error;
    }
  };
};

// Helper to convert empty strings to undefined
const emptyToUndefined = (v: string | undefined) => v && v.trim() ? v : undefined;

// ============================================================
// Common validation schemas
// ============================================================

// Pagination
export const paginationSchema = z.object({
  page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1', 10) || 1)),
  limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '50', 10) || 50))),
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

// ID params
export const idParamSchema = z.object({
  id: z.string().transform(v => {
    const num = parseInt(v, 10);
    if (isNaN(num) || num < 1) throw new Error('Invalid ID');
    return num;
  }),
});

// ============================================================
// Auth validation schemas
// ============================================================

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(1, 'Password is required').max(200),
});

export const loginKundeSchema = z.object({
  kundenr: z.string().min(1, 'Kundenr is required').max(50),
  password: z.string().min(1, 'Password is required').max(200),
});

// ============================================================
// ETL validation schemas
// ============================================================

export const bulkDataSchema = z.object({
  customers: z.number().int().min(1).max(100000).default(1000),
  orders: z.number().int().min(1).max(10000000).default(100000),
  linesPerOrder: z.number().int().min(1).max(100).default(5),
  actionKey: z.string().min(1).max(200).optional(),
});

export const etlIngestSchema = z.object({
  sourceType: z.enum(['csv', 'json', 'api']),
  table: z.enum(['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager']),
  strictMode: z.boolean().default(false),
  onConflict: z.enum(['nothing', 'error']).default('nothing'),
  sourceMapping: z.record(z.string(), z.string()).optional(),
  csv: z.object({
    delimiter: z.string().min(1).max(2).optional(),
  }).optional(),
  json: z.object({
    mode: z.enum(['ndjson', 'array']).default('array'),
    filePath: z.string().max(500).optional(),
  }).optional(),
  api: z.object({
    url: z.string().url(),
    method: z.enum(['GET', 'POST']).default('GET'),
    headers: z.record(z.string(), z.string()).optional(),
    body: z.record(z.string(), z.unknown()).optional(),
    timeoutMs: z.number().int().min(1000).max(120000).default(20000),
    dataPath: z.string().max(200).optional(),
    nextPagePath: z.string().max(200).optional(),
    maxPages: z.number().int().min(1).max(100000).default(1000),
  }).optional(),
});

// ============================================================
// Pricing validation schemas
// ============================================================

export const createGroupSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
});

export const createPriceListSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  valid_from: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform(v => `${v}T00:00:00Z`)).optional(),
  valid_to: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform(v => `${v}T23:59:59Z`)).optional(),
  priority: z.number().int().min(0).max(1000).default(0),
  is_active: z.boolean().default(true),
});

export const createPriceRuleSchema = z.object({
  price_list_id: z.number().int().positive(),
  varekode: z.string().max(50).optional(),
  varegruppe: z.string().max(100).optional(),
  kundenr: z.string().max(50).optional(),
  customer_group_id: z.number().int().positive().optional(),
  min_quantity: z.number().min(0).default(0),
  discount_percent: z.number().min(0).max(100).optional(),
  fixed_price: z.number().min(0).optional(),
});

export const calculatePriceSchema = z.object({
  varekode: z.string().min(1).max(50),
  varegruppe: z.string().max(100).optional(),
  kundenr: z.string().min(1).max(50),
  quantity: z.number().positive(),
  base_price: z.number().min(0),
});

// ============================================================
// Pricing simulation schemas
// ============================================================

export const simulateSchema = z.object({
  proposed_rule: z.object({
    rule_id: z.number().int().optional().nullable(),
    price_list_id: z.number().int().positive(),
    varekode: z.string().max(50).optional().nullable(),
    varegruppe: z.string().max(100).optional().nullable(),
    kundenr: z.string().max(50).optional().nullable(),
    customer_group_id: z.number().int().positive().optional().nullable(),
    min_quantity: z.number().min(0).default(0),
    discount_percent: z.number().min(0).max(100).optional().nullable(),
    fixed_price: z.number().min(0).optional().nullable(),
  }),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  sample_size: z.number().int().min(1).max(5000).default(1000),
});

// ============================================================
// Order validation schemas
// ============================================================

export const orderQuerySchema = paginationSchema.merge(dateRangeSchema).extend({
  kundenr: z.string().optional().transform(emptyToUndefined),
  ordrenr: z.string().optional().transform(emptyToUndefined),
  firmaid: z.string().optional().transform(v => v && v.trim() ? parseInt(v, 10) : undefined),
  lagernavn: z.string().optional().transform(emptyToUndefined),
  kundeordreref: z.string().optional().transform(emptyToUndefined),
  kunderef: z.string().optional().transform(emptyToUndefined),
  search: z.string().optional().transform(emptyToUndefined),
  q: z.string().optional().transform(emptyToUndefined),
});

export const orderLineSchema = z.object({
  ordrenr: z.number().int().positive(),
  varekode: z.string().min(1).max(50),
  antall: z.number().positive(),
  enhet: z.string().max(20).optional(),
  nettpris: z.number().min(0),
  linjesum: z.number().min(0).optional(),
  linjestatus: z.number().int().min(0).max(10).optional(),
});

// ============================================================
// User management validation schemas
// ============================================================

export const createUserSchema = z.object({
  username: z.string().min(1, 'Username is required').max(100),
  password: z.string().min(4, 'Password must be at least 4 characters').max(200),
  role: z.enum(['admin', 'kunde', 'analyse'], { error: 'Role must be admin, kunde, or analyse' }),
  kundenr: z.string().max(50).optional(),
});

export const updateUserSchema = z.object({
  username: z.string().min(1).max(100).optional(),
  password: z.string().min(4, 'Password must be at least 4 characters').max(200).optional(),
  role: z.enum(['admin', 'kunde', 'analyse'], { error: 'Role must be admin, kunde, or analyse' }).optional(),
  kundenr: z.string().max(50).optional().nullable(),
  actionKey: z.string().min(1).max(200).optional(),
});

export const deleteUserSchema = z.object({
  actionKey: z.string().min(1, 'Action key is required').max(200),
});

// ============================================================
// Search/suggestions validation
// ============================================================

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});
