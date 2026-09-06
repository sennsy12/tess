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
}).superRefine((v, ctx) => {
  if (v.valid_from && v.valid_to && v.valid_from > v.valid_to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'valid_from must be <= valid_to',
      path: ['valid_to'],
    });
  }
});

export const createPriceRuleSchema = z.object({
  price_list_id: z.number().int().positive(),
  varekode: z.string().max(50).optional(),
  varegruppe: z.string().max(50).optional(),
  kundenr: z.string().max(50).optional(),
  customer_group_id: z.number().int().positive().optional(),
  min_quantity: z.number().int().min(0).default(0),
  discount_percent: z.number().min(0).max(100).optional(),
  fixed_price: z.number().min(0).optional(),
}).superRefine((v, ctx) => {
  const hasDiscount = v.discount_percent !== undefined;
  const hasFixed = v.fixed_price !== undefined;
  if (hasDiscount === hasFixed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one of discount_percent or fixed_price is required',
      path: ['discount_percent'],
    });
  }
});

export const calculatePriceSchema = z.object({
  varekode: z.string().min(1).max(50),
  varegruppe: z.string().max(50).optional(),
  kundenr: z.string().min(1).max(50),
  quantity: z.number().positive().max(1_000_000),
  base_price: z.number().min(0).max(10_000_000),
});

// ============================================================
// Update schemas (PUT) — all fields optional, NO defaults.
//
// NOTE: deliberately NOT `createXSchema.partial()`: the create schemas
// carry `.default(...)` (priority, is_active, min_quantity) and
// `.partial()` preserves those defaults, so validating a PUT body of
// `{}` would inject `{ priority: 0, ... }` and overwrite stored values.
// These explicit schemas validate shape without injecting anything,
// so partial updates stay partial (models use COALESCE / dynamic SET).
// Nullable is allowed where Update*Input types permit clearing.
// ============================================================

export const updateGroupSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional().nullable(),
});

export const updatePriceListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  valid_from: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => `${v}T00:00:00Z`))
    .optional()
    .nullable(),
  valid_to: z
    .string()
    .datetime()
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((v) => `${v}T23:59:59Z`))
    .optional()
    .nullable(),
  priority: z.number().int().min(0).max(1000).optional(),
  is_active: z.boolean().optional(),
}).superRefine((v, ctx) => {
  if (v.valid_from && v.valid_to && v.valid_from > v.valid_to) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'valid_from must be <= valid_to',
      path: ['valid_to'],
    });
  }
});

export const updatePriceRuleSchema = z.object({
  varekode: z.string().max(50).optional().nullable(),
  varegruppe: z.string().max(50).optional().nullable(),
  kundenr: z.string().max(50).optional().nullable(),
  customer_group_id: z.number().int().positive().optional().nullable(),
  min_quantity: z.number().int().min(0).optional(),
  discount_percent: z.number().min(0).max(100).optional().nullable(),
  fixed_price: z.number().min(0).optional().nullable(),
}).superRefine((v, ctx) => {
  // Partial update: allow touching neither mechanism, but if both keys are
  // present they must be XOR (exactly one non-null) to avoid degenerate rules.
  const hasDiscountKey = v.discount_percent !== undefined;
  const hasFixedKey = v.fixed_price !== undefined;
  if (hasDiscountKey && hasFixedKey) {
    const hasDiscount = v.discount_percent != null;
    const hasFixed = v.fixed_price != null;
    if (hasDiscount === hasFixed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exactly one of discount_percent or fixed_price must be non-null when both are provided',
        path: ['discount_percent'],
      });
    }
  }
});

// Numeric `:id` params — coerce handles Express string params and yields a
// proper ZodError (→ 400 via validate()) for NaN, unlike parseInt + DB error (500).
export const pricingIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const assignCustomerParamSchema = z.object({
  id: z.coerce.number().int().positive(),
  kundenr: z.string().min(1).max(50),
});

export const removeCustomerParamSchema = z.object({
  kundenr: z.string().min(1).max(50),
});

export const checkConflictsSchema = z.object({
  price_list_id: z.number().int().positive(),
  varekode: z.string().max(50).optional().nullable(),
  varegruppe: z.string().max(50).optional().nullable(),
  kundenr: z.string().max(50).optional().nullable(),
  customer_group_id: z.number().int().positive().optional().nullable(),
  min_quantity: z.number().int().min(0).optional(),
  exclude_rule_id: z.coerce.number().int().positive().optional(),
});

// Bulk item reuses calculatePriceSchema minus per-item kundenr
// (kundenr is top-level, matching POST /calculate/bulk { items, kundenr }).
export const calculateBulkItemSchema = calculatePriceSchema.omit({ kundenr: true });

export const calculateBulkSchema = z.object({
  kundenr: z.string().min(1).max(50),
  items: z.array(calculateBulkItemSchema).min(1).max(200),
});

// ============================================================
// Pricing simulation schemas
// ============================================================

export const simulateSchema = z.object({
  proposed_rule: z.object({
    rule_id: z.number().int().optional().nullable(),
    price_list_id: z.number().int().positive(),
    varekode: z.string().max(50).optional().nullable(),
    varegruppe: z.string().max(50).optional().nullable(),
    kundenr: z.string().max(50).optional().nullable(),
    customer_group_id: z.number().int().positive().optional().nullable(),
    min_quantity: z.number().int().min(0).default(0),
    discount_percent: z.number().min(0).max(100).optional().nullable(),
    fixed_price: z.number().min(0).optional().nullable(),
  }).superRefine((v, ctx) => {
    const hasDiscount = v.discount_percent != null;
    const hasFixed = v.fixed_price != null;
    if (hasDiscount === hasFixed) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'proposed_rule requires exactly one of discount_percent or fixed_price',
        path: ['discount_percent'],
      });
    }
  }),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD').optional(),
  sample_size: z.number().int().min(1).max(5000).default(1000),
}).superRefine((v, ctx) => {
  if (v.start_date && v.end_date && v.start_date > v.end_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'start_date must be <= end_date',
      path: ['end_date'],
    });
  }
});
