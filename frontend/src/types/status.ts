export interface ApiEndpointMetric {
  path: string;
  method: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  count: number;
  slowCount: number;
  lastCalled: string;
}

export interface RecentActivityData {
  dataFreshness: {
    lastOrderDate: string | null;
    daysSinceLastOrder: number | null;
    totalCustomers: number;
    totalProducts: number;
  };
  status: 'fresh' | 'stale';
  message: string;
}

export interface ApiMetricsData {
  summary: {
    totalEndpoints: number;
    totalRequests: number;
    totalSlowRequests: number;
    slowestEndpoint: { path: string; method: string; avgMs: number } | null;
    mostCalled: { path: string; method: string; count: number } | null;
    status: string;
  };
  endpoints: ApiEndpointMetric[];
}
