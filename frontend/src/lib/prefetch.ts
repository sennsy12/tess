import type { QueryClient } from '@tanstack/react-query';
import { statusApi } from './api';

/** Prefetch data for heavy admin routes on nav hover. */
export function prefetchRoute(queryClient: QueryClient, path: string) {
  if (path === '/admin/statistics' || path.startsWith('/admin/statistics')) {
    void queryClient.prefetchQuery({
      queryKey: ['admin', 'statistics'],
      queryFn: () => Promise.resolve(null),
      staleTime: 60_000,
    });
  }
  if (path === '/admin/status') {
    void queryClient.prefetchQuery({
      queryKey: ['admin', 'status'],
      queryFn: () => statusApi.getStatus().then((r) => r.data),
      staleTime: 30_000,
    });
  }
}
