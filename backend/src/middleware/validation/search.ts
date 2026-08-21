import { z } from 'zod';
import { emptyToUndefined, paginationSchema, sortQuerySchema } from './common.js';

// ============================================================
// Search/suggestions validation
// ============================================================

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

// ============================================================
// Product / user / pricing list query schemas
// ============================================================

export const productListQuerySchema = paginationSchema.merge(sortQuerySchema).extend({
  search: z.string().optional().transform(emptyToUndefined),
  varegruppe: z.string().optional().transform(emptyToUndefined),
});

export const pricingCustomerSearchSchema = paginationSchema.merge(sortQuerySchema).extend({
  search: z.string().optional().transform(emptyToUndefined),
  group: z.string().optional().transform(emptyToUndefined),
});

export const userListQuerySchema = paginationSchema;

export const userSearchQuerySchema = paginationSchema.extend({
  q: z.string().optional().transform(emptyToUndefined),
  search: z.string().optional().transform(emptyToUndefined),
});

export const auditQuerySchema = paginationSchema.extend({
  entity_type: z.string().optional(),
  action: z.string().optional(),
  user_id: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? parseInt(v, 10) : undefined)),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});
