import { z } from 'zod';
import { ORDER_WORKFLOW_STATUSES } from '../../lib/orderWorkflow.js';
import { dateRangeSchema, emptyToUndefined, paginationSchema, sortQuerySchema } from './common.js';

// ============================================================
// Order validation schemas
// ============================================================

export const orderQuerySchema = paginationSchema.merge(dateRangeSchema).merge(sortQuerySchema).extend({
  kundenr: z.string().optional().transform(emptyToUndefined),
  ordrenr: z.string().optional().transform(emptyToUndefined),
  firmaid: z.string().optional().transform(v => v && v.trim() ? parseInt(v, 10) : undefined),
  lagernavn: z.string().optional().transform(emptyToUndefined),
  kundeordreref: z.string().optional().transform(emptyToUndefined),
  kunderef: z.string().optional().transform(emptyToUndefined),
  search: z.string().optional().transform(emptyToUndefined),
  q: z.string().optional().transform(emptyToUndefined),
  workflowStatus: z
    .preprocess((v) => (v === '' ? undefined : v), z.enum(ORDER_WORKFLOW_STATUSES).optional()),
});

export const updateOrderStatusSchema = z.object({
  workflowStatus: z.enum(ORDER_WORKFLOW_STATUSES),
  /** Decision comment — required when rejecting, optional otherwise (max 500). */
  comment: z.string().max(500).optional(),
});

// ============================================================
// Customer order placement schemas
// ============================================================

export const createOrderItemSchema = z.object({
  varekode: z.string().min(1).max(50),
  antall: z.number().positive('Quantity must be positive').max(1_000_000),
});

export const createOrderSchema = z
  .object({
    items: z.array(createOrderItemSchema).min(1, 'Order must contain at least one item').max(200),
    kundeordreref: z.string().max(100).optional(),
    kunderef: z.string().max(100).optional(),
    lagernavn: z.string().max(100).optional(),
    valutaid: z.string().min(1).max(10).default('NOK'),
    /** Client-generated unique key for double-submit protection. */
    idempotencyKey: z
      .string()
      .min(8)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/, 'idempotencyKey must be alphanumeric'),
    /** Admins may place orders on behalf of a customer; kunde users cannot override. */
    kundenr: z.string().min(1).max(50).optional(),
  })
  .superRefine((data, ctx) => {
    const seen = new Set<string>();
    for (const [index, item] of data.items.entries()) {
      if (seen.has(item.varekode)) {
        ctx.addIssue({
          code: 'custom',
          path: ['items', index, 'varekode'],
          message: `Duplicate product in order: ${item.varekode}`,
        });
      }
      seen.add(item.varekode);
    }
  });

/** Admin sets the catalog base price on a product. */
export const updateProductPriceSchema = z.object({
  base_price: z.number().min(0).max(10_000_000),
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
