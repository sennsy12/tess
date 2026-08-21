import { z } from 'zod';
import { emptyToUndefined, paginationSchema, sortQuerySchema } from './common.js';

// ============================================================
// Catalog (customer-facing product list with prices)
// ============================================================

export const catalogQuerySchema = paginationSchema.merge(sortQuerySchema).extend({
  search: z.string().optional().transform(emptyToUndefined),
  varegruppe: z.string().optional().transform(emptyToUndefined),
  /** Admin-only: browse the catalog as a specific customer. */
  kundenr: z.string().optional().transform(emptyToUndefined),
});

export const notificationQuerySchema = paginationSchema.extend({
  unreadOnly: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
});

export const markNotificationsReadSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(200),
});
