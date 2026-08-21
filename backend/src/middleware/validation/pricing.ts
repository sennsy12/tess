import { z } from 'zod';

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
