import type { DataTableState } from '../components/DataTable';

export type SortDirection = 'asc' | 'desc' | null;

export type OrderFilters = {
  ordrenr: string;
  startDate: string;
  endDate: string;
  search: string;
  workflowStatus: string;
} & Record<string, string>;

export type ProductFilters = {
  search: string;
  groupFilter: string;
} & Record<string, string>;

export type CustomerFilters = {
  search: string;
  groupFilter: string;
} & Record<string, string>;

export const orderKeys = {
  /** Prefix for every admin order query (used for broad invalidation). */
  root: () => ['admin', 'orders'] as const,
  list: (
    scope: 'admin' | 'kunde',
    page: number,
    filters: OrderFilters,
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => [scope, 'orders', page, filters, sortKey, sortDirection] as const,
};

export const productKeys = {
  /** Prefix for every admin product query (used for broad invalidation). */
  root: () => ['admin', 'products'] as const,
  groups: () => ['admin', 'product-groups'] as const,
  list: (
    page: number,
    filters: ProductFilters,
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => ['admin', 'products', page, filters, sortKey, sortDirection] as const,
};

export const catalogKeys = {
  list: (
    page: number,
    filters: { search: string; varegruppe: string },
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => ['kunde', 'catalog', page, filters, sortKey, sortDirection] as const,
};

export const customerKeys = {
  groups: () => ['admin', 'customer-groups'] as const,
  list: (
    page: number,
    filters: CustomerFilters,
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => ['admin', 'customers', page, filters, sortKey, sortDirection] as const,
  orders: (filters: Record<string, unknown>) =>
    ['admin', 'customer-orders', filters] as const,
};

export const userKeys = {
  /** Prefix for every admin user query (used for broad invalidation). */
  root: () => ['admin', 'users'] as const,
  list: (page: number) => ['admin', 'users', page] as const,
  all: () => ['admin', 'users', 'all'] as const,
};

export const auditKeys = {
  list: (
    page: number,
    filterType: string,
    filterAction: string,
    filterUser: string,
    startDate: string,
    endDate: string,
  ) => ['admin', 'audit', page, filterType, filterAction, filterUser, startDate, endDate] as const,
};

export const statisticsKeys = {
  list: (
    scope: string,
    statType: string,
    page: number,
    dateRange: { startDate: string; endDate: string },
    filters: { kundenr: string; varegruppe: string },
  ) => [scope, 'statistics', statType, page, dateRange, filters] as const,
  comparison: (
    scope: string,
    dateRange: { startDate: string; endDate: string },
    compareEnabled: boolean,
  ) => [scope, 'statistics', 'comparison', dateRange, compareEnabled] as const,
  summary: (scope: string, dateRange: { startDate: string; endDate: string }) =>
    [scope, 'statistics', 'summary', dateRange] as const,
};

export const statusKeys = {
  system: () => ['admin', 'status'] as const,
  import: () => ['admin', 'import-status'] as const,
  extraction: () => ['admin', 'extraction-status'] as const,
  health: () => ['admin', 'health'] as const,
  apiMetrics: () => ['admin', 'api-metrics'] as const,
  etlMetrics: () => ['admin', 'etl-metrics'] as const,
};

/** Approval queue queries (dashboard widget + /admin/approvals page). */
export const approvalsKeys = {
  /** Prefix for both the list and count families. */
  root: () => ['admin', 'approvals'] as const,
  list: (status: string, page: number) => ['admin', 'approvals', status, page] as const,
  /** Prefix for every per-status count query. */
  countRoot: () => ['admin', 'approvals-count'] as const,
  count: (status: string) => ['admin', 'approvals-count', status] as const,
};

/** Admin dashboard widget queries. */
export const dashboardKeys = {
  widgets: () => ['admin', 'widgets'] as const,
  apiMetrics: () => ['admin', 'dashboard-api-metrics'] as const,
  ordersNeedingAttention: () => ['admin', 'orders-needing-attention'] as const,
  pendingApprovalCount: () => ['admin', 'pending-approval-count'] as const,
  analytics: () => ['admin', 'analytics'] as const,
};

export const etlKeys = {
  all: () => ['admin', 'etl-jobs'] as const,
  jobs: (limit: number) => ['admin', 'etl-jobs', limit] as const,
  detail: (jobId: string) => ['admin', 'etl-jobs', 'detail', jobId] as const,
  tableCounts: () => ['admin', 'etl', 'table-counts'] as const,
};

export const schedulerKeys = {
  jobs: () => ['admin', 'scheduler', 'jobs'] as const,
};

export const accountKeys = {
  profile: (kundenr: string) => ['kunde', 'account', kundenr] as const,
};

/**
 * Kunde-scope query keys. Invalidation helpers use prefix semantics, so the
 * `root`/`ordersRoot` entries let callers invalidate whole families at once.
 */
export const kundeKeys = {
  root: () => ['kunde'] as const,
  summary: () => ['kunde', 'summary'] as const,
  recentOrders: () => ['kunde', 'recentOrders'] as const,
  varegruppeStats: () => ['kunde', 'varegruppeStats'] as const,
  timeSeries: () => ['kunde', 'timeSeries'] as const,
  productGroups: () => ['kunde', 'product-groups'] as const,
  catalogRoot: () => ['kunde', 'catalog'] as const,
  ordersRoot: () => ['kunde', 'orders'] as const,
  order: (ordrenr: number) => ['kunde', 'order', ordrenr] as const,
};

export const pricingKeys = {
  all: () => ['admin', 'pricing'] as const,
  groups: () => ['admin', 'pricing', 'groups'] as const,
  lists: () => ['admin', 'pricing', 'lists'] as const,
  rules: (listId: number) => ['admin', 'pricing', 'rules', listId] as const,
  customersWithGroups: () => ['admin', 'pricing', 'customers-with-groups'] as const,
  auditLog: (page: number, filters: Record<string, string>) =>
    ['admin', 'pricing', 'audit-log', page, filters] as const,
  customerRules: (kundenr: string) => ['kunde', 'pricing', kundenr] as const,
};

export type AnalyticsScope = 'kunde-advanced-analytics' | 'admin-advanced-analytics';

export type AnalyticsQueryConfig = {
  metric: string;
  dimension: string;
  startDate: string;
  endDate: string;
  search: string;
};

export const analyticsKeys = {
  custom: (scope: AnalyticsScope, config: AnalyticsQueryConfig) =>
    [scope, config.metric, config.dimension, config.startDate, config.endDate, config.search] as const,
};

export const orderLineKeys = {
  orders: () => ['admin', 'orderlines', 'orders'] as const,
  linesRoot: (ordrenr: number) => ['admin', 'orderlines', ordrenr] as const,
  lines: (ordrenr: number, page: number) => ['admin', 'orderlines', ordrenr, page] as const,
  productSearch: (query: string) => ['admin', 'orderlines', 'products', query] as const,
};

export const reportKeys = {
  all: () => ['reports'] as const,
};

export const queryKeys = {
  assistant: {
    status: ['assistant', 'status'] as const,
  },
};

/** Default list state for prefetch (page 1, empty filters, no sort). */
export function defaultTableSort(): Pick<DataTableState, 'sortKey' | 'sortDirection'> {
  return { sortKey: null, sortDirection: null };
}
