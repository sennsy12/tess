import type { QueryClient } from '@tanstack/react-query';
import { ordersApi, pricingApi, productsApi, statisticsApi, statusApi, usersApi, auditApi } from './api';
import {
  orderKeys,
  productKeys,
  customerKeys,
  userKeys,
  auditKeys,
  statisticsKeys,
  statusKeys,
  defaultTableSort,
  type OrderFilters,
  type ProductFilters,
  type CustomerFilters,
} from './queryKeys';

const DEFAULT_ORDER_FILTERS: OrderFilters = {
  ordrenr: '',
  startDate: '',
  endDate: '',
  search: '',
  workflowStatus: '',
};

const DEFAULT_PRODUCT_FILTERS: ProductFilters = { search: '', groupFilter: '' };

const DEFAULT_CUSTOMER_FILTERS: CustomerFilters = { search: '', groupFilter: '' };

const DEFAULT_STATS_PARAMS = {
  startDate: undefined as string | undefined,
  endDate: undefined as string | undefined,
  kundenr: undefined as string | undefined,
  varegruppe: undefined as string | undefined,
  page: 1,
  limit: 25,
};

const DEFAULT_PRODUCT_SORT = { sortKey: 'varenavn' as const, sortDirection: 'asc' as const };

/** Prefetch data for heavy admin routes on nav hover. */
export function prefetchRoute(queryClient: QueryClient, path: string) {
  const { sortKey, sortDirection } = defaultTableSort();

  if (path === '/admin/orders' || path.startsWith('/admin/orders')) {
    void queryClient.prefetchQuery({
      queryKey: orderKeys.list('admin', 1, DEFAULT_ORDER_FILTERS, sortKey, sortDirection),
      queryFn: () =>
        ordersApi.getAll({ page: 1, limit: 50 }).then((r) => ({
          orders: r.data.data,
          total: r.data.pagination.total,
        })),
      staleTime: 60_000,
    });
  }

  if (path === '/kunde/orders' || path.startsWith('/kunde/orders')) {
    void queryClient.prefetchQuery({
      queryKey: orderKeys.list('kunde', 1, DEFAULT_ORDER_FILTERS, sortKey, sortDirection),
      queryFn: () =>
        ordersApi.getAll({ page: 1, limit: 50 }).then((r) => ({
          orders: r.data.data ?? [],
          total: r.data.pagination?.total ?? 0,
        })),
      staleTime: 60_000,
    });
  }

  if (path === '/admin/customers' || path.startsWith('/admin/customers')) {
    void queryClient.prefetchQuery({
      queryKey: customerKeys.list(1, DEFAULT_CUSTOMER_FILTERS, sortKey, sortDirection),
      queryFn: () =>
        pricingApi.searchCustomers({ page: 1, limit: 25 }).then((r) => ({
          customers: r.data.data,
          pagination: r.data.pagination,
        })),
      staleTime: 5 * 60_000,
    });
  }

  if (path === '/admin/products' || path.startsWith('/admin/products')) {
    void queryClient.prefetchQuery({
      queryKey: productKeys.list(
        1,
        DEFAULT_PRODUCT_FILTERS,
        DEFAULT_PRODUCT_SORT.sortKey,
        DEFAULT_PRODUCT_SORT.sortDirection,
      ),
      queryFn: () =>
        productsApi.search({ page: 1, limit: 25, sortBy: 'varenavn', sortDir: 'asc' }).then((r) => ({
          products: r.data.data,
          pagination: r.data.pagination,
        })),
      staleTime: 5 * 60_000,
    });
  }

  if (path === '/admin/users' || path.startsWith('/admin/users')) {
    void queryClient.prefetchQuery({
      queryKey: userKeys.list(1),
      queryFn: () => usersApi.getAll({ page: 1, limit: 20 }).then((r) => r.data),
      staleTime: 5 * 60_000,
    });
  }

  if (path === '/admin/audit') {
    void queryClient.prefetchQuery({
      queryKey: auditKeys.list(1, '', '', '', '', ''),
      queryFn: () => auditApi.getAll({ page: 1, limit: 25 }).then((r) => r.data),
      staleTime: 60_000,
    });
  }

  if (path === '/admin/statistics' || path.startsWith('/admin/statistics')) {
    const dateRange = { startDate: '', endDate: '' };
    const filters = { kundenr: '', varegruppe: '' };
    void queryClient.prefetchQuery({
      queryKey: statisticsKeys.list('kunde', 1, dateRange, filters),
      queryFn: () => statisticsApi.byKunde(DEFAULT_STATS_PARAMS).then((r) => r.data),
      staleTime: 60_000,
    });
  }

  if (path === '/admin/status') {
    void queryClient.prefetchQuery({
      queryKey: statusKeys.system(),
      queryFn: () => statusApi.getStatus().then((r) => r.data),
      staleTime: 30_000,
    });
  }
}
