import type { QueryClient } from '@tanstack/react-query';
// Direct module imports (not the lib/api barrel) so this Layout-reachable
// file does not pull all 19 API clients into the shared graph.
import { ordersApi } from './api/orders';
import { pricingApi } from './api/pricing';
import { productsApi } from './api/products';
import { statisticsApi } from './api/statistics';
import { statusApi } from './api/status';
import { usersApi } from './api/users';
import { auditApi } from './api/audit';
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

/**
 * Route JS chunk loaders, mirroring the React.lazy() map in App.tsx.
 *
 * Warming the chunk on nav hover/focus makes the click feel instant — the
 * data prefetch below already covers the API side. Entries are static
 * imports so Vite keeps emitting one chunk per route; failures are
 * swallowed (prefetch must never break navigation).
 */
const ROUTE_CHUNK_LOADERS: Array<{ match: (path: string) => boolean; load: () => Promise<unknown> }> = [
  { match: (p) => p === '/login', load: () => import('../pages/Login') },
  { match: (p) => p === '/hjelp', load: () => import('../pages/Help') },
  { match: (p) => p.endsWith('/settings'), load: () => import('../pages/Settings') },
  { match: (p) => p === '/kunde', load: () => import('../pages/kunde/Dashboard') },
  { match: (p) => p === '/kunde/order/new', load: () => import('../pages/kunde/NewOrder') },
  {
    match: (p) => p.startsWith('/kunde/orders'),
    load: () => Promise.all([import('../pages/kunde/Orders'), import('../pages/kunde/OrderDetail')]),
  },
  { match: (p) => p === '/kunde/konto', load: () => import('../pages/kunde/Account') },
  { match: (p) => p === '/kunde/pricing', load: () => import('../pages/kunde/Pricing') },
  { match: (p) => p === '/kunde/analytics', load: () => import('../pages/kunde/AdvancedAnalytics') },
  { match: (p) => p === '/kunde/statistics', load: () => import('../pages/kunde/Statistics') },
  { match: (p) => p === '/kunde/varsler', load: () => import('../pages/kunde/Notifications') },
  { match: (p) => p === '/analyse', load: () => import('../pages/analyse/Dashboard') },
  { match: (p) => p === '/analyse/statistics', load: () => import('../pages/analyse/Statistics') },
  { match: (p) => p === '/admin', load: () => import('../pages/admin/Dashboard') },
  { match: (p) => p === '/admin/approvals', load: () => import('../pages/admin/Approvals') },
  { match: (p) => p === '/admin/orderlines', load: () => import('../pages/admin/OrderLines') },
  { match: (p) => p === '/admin/status', load: () => import('../pages/admin/Status') },
  { match: (p) => p === '/admin/etl', load: () => import('../pages/admin/ETL') },
  { match: (p) => p === '/admin/pricing', load: () => import('../pages/admin/pricing') },
  { match: (p) => p === '/admin/statistics', load: () => import('../pages/admin/Statistics') },
  {
    match: (p) => p.startsWith('/admin/orders'),
    load: () => Promise.all([import('../pages/admin/Orders'), import('../pages/admin/OrderDetail')]),
  },
  { match: (p) => p === '/admin/analytics', load: () => import('../pages/admin/AdvancedAnalytics') },
  { match: (p) => p === '/admin/users', load: () => import('../pages/admin/Users') },
  { match: (p) => p === '/admin/customers', load: () => import('../pages/admin/Customers') },
  { match: (p) => p === '/admin/products', load: () => import('../pages/admin/Products') },
  { match: (p) => p === '/admin/audit', load: () => import('../pages/admin/Audit') },
  { match: (p) => p === '/admin/varsler', load: () => import('../pages/admin/Notifications') },
];

/** Warm the target route's JS chunk (see ROUTE_CHUNK_LOADERS). Never throws. */
export function prefetchRouteChunk(path: string) {
  try {
    for (const { match, load } of ROUTE_CHUNK_LOADERS) {
      if (match(path)) {
        load().catch(() => undefined);
        return;
      }
    }
  } catch {
    // Intentionally ignored — prefetch is best-effort.
  }
}

/** Prefetch data for heavy admin routes on nav hover. */
export function prefetchRoute(queryClient: QueryClient, path: string) {
  // Chunk first: it parallelizes with the data queries below.
  prefetchRouteChunk(path);
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
      queryKey: statisticsKeys.list('admin-statistics', 'kunde', 1, dateRange, filters),
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
