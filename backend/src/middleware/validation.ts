/**
 * Validation middleware and schemas.
 *
 * Split into single-responsibility domain modules under `validation/`;
 * this barrel re-exports everything so the public API is unchanged.
 */

export { validate } from './validation/factory.js';

export {
  paginationSchema,
  sortQuerySchema,
  dateRangeSchema,
  statisticsQuerySchema,
  statisticsSummarySchema,
  statisticsTimeSeriesSchema,
  statisticsCustomSchema,
  idParamSchema,
} from './validation/common.js';

export {
  loginSchema,
  loginKundeSchema,
  changePasswordSchema,
  refreshTokenSchema,
  revokeRefreshTokenSchema,
  entraLoginSchema,
} from './validation/auth.js';

export {
  bulkDataSchema,
  bulkStagesSchema,
  bulkStreamingSchema,
  etlIngestSchema,
} from './validation/etl.js';

export type { EtlIngestBody } from './validation/etl.js';

export {
  createGroupSchema,
  createPriceListSchema,
  createPriceRuleSchema,
  calculatePriceSchema,
  calculateBulkSchema,
  calculateBulkItemSchema,
  updateGroupSchema,
  updatePriceListSchema,
  updatePriceRuleSchema,
  pricingIdParamSchema,
  assignCustomerParamSchema,
  removeCustomerParamSchema,
  checkConflictsSchema,
  simulateSchema,
} from './validation/pricing.js';

export {
  orderQuerySchema,
  updateOrderStatusSchema,
  createOrderItemSchema,
  createOrderSchema,
  updateProductPriceSchema,
  orderLineSchema,
  updateOrderLineSchema,
  ordrenrParamSchema,
  orderLineParamsSchema,
} from './validation/orders.js';

export {
  catalogQuerySchema,
  notificationQuerySchema,
  markNotificationsReadSchema,
} from './validation/catalog.js';

export {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  entraLinkSchema,
} from './validation/users.js';

export {
  searchQuerySchema,
  productListQuerySchema,
  pricingCustomerSearchSchema,
  userListQuerySchema,
  userSearchQuerySchema,
  auditQuerySchema,
} from './validation/search.js';

export {
  tableKeyParamSchema,
  tablePreferencesBodySchema,
  MAX_COLUMN_LABEL_LENGTH,
} from './validation/tablePreferences.js';

export type { TablePreferencesBody } from './validation/tablePreferences.js';
