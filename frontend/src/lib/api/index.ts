/**
 * API Module Barrel File
 * Re-exports all API clients and types from their individual modules.
 */

// Core client
export { default } from './client';

// API clients
export { authApi } from './auth';
export { ordersApi, orderlinesApi } from './orders';
export { statisticsApi } from './statistics';
export { pricingApi } from './pricing';
export { auditApi } from './audit';
export { customersApi } from './customers';
export { productsApi } from './products';
export { etlApi } from './etl';
export { statusApi } from './status';
export { reportsApi } from './reports';
export { schedulerApi } from './scheduler';
export { suggestionsApi } from './suggestions';
export { dashboardApi } from './dashboard';
export { usersApi } from './users';

// Types
export type {
  PaginationParams,
  PaginatedResponse,
  StatisticsSummary,
  TimeSeriesPoint,
  KundeStats,
  VaregruppeStats,
  VareStats,
  LagerStats,
  FirmaStats,
  StatisticsBatchResponse,
  DashboardAnalyticsBatchResponse,
} from './statistics';

export type {
  UserPublic,
  CreateUserPayload,
  UpdateUserPayload,
} from './users';
