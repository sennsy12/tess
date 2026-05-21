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
    statType: string,
    page: number,
    dateRange: { startDate: string; endDate: string },
    filters: { kundenr: string; varegruppe: string },
  ) => ['admin', 'statistics', statType, page, dateRange, filters] as const,
};

export const statusKeys = {
  system: () => ['admin', 'status'] as const,
};

export const etlKeys = {
  jobs: (limit: number) => ['admin', 'etl-jobs', limit] as const,
};

export const accountKeys = {
  profile: (kundenr: string) => ['kunde', 'account', kundenr] as const,
};

export const pricingKeys = {
  customerRules: (kundenr: string) => ['kunde', 'pricing', kundenr] as const,
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
