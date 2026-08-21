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
  list: (
    scope: 'admin' | 'kunde',
    page: number,
    filters: OrderFilters,
    sortKey: string | null,
    sortDirection: SortDirection,
  ) => [scope, 'orders', page, filters, sortKey, sortDirection] as const,
};

export const productKeys = {
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
  orders: (customerId: string, filters: Record<string, unknown>) =>
    ['admin', 'customer-orders', customerId, filters] as const,
};

export const userKeys = {
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
};

export const etlKeys = {
  all: () => ['admin', 'etl-jobs'] as const,
  jobs: (limit: number) => ['admin', 'etl-jobs', limit] as const,
  tableCounts: () => ['admin', 'etl', 'table-counts'] as const,
};

export const schedulerKeys = {
  jobs: () => ['admin', 'scheduler', 'jobs'] as const,
};

export const accountKeys = {
  profile: (kundenr: string) => ['kunde', 'account', kundenr] as const,
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
