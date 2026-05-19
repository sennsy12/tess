export interface TopProduct {
  varekode: string;
  varenavn: string;
  varegruppe: string;
  order_count: number;
  total_quantity: number;
  total_revenue: number;
}

export interface TopProductsWidgetProps {
  data: TopProduct[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export interface TopCustomer {
  kundenr: string;
  kundenavn: string;
  order_count: number;
  total_revenue: number;
  last_order_date: string;
}

export interface TopCustomersWidgetProps {
  data: TopCustomer[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export interface PriceDeviation {
  kundenr: string;
  kundenavn: string;
  customer_group_name: string | null;
  rule_count: number;
  avg_discount: number;
  max_discount: number;
}

export interface PriceDeviationsWidgetProps {
  data: PriceDeviation[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export interface DataFreshness {
  lastOrderDate: string | null;
  daysSinceLastOrder: number | null;
  totalCustomers: number;
  totalProducts: number;
}

export interface DataStatusWidgetProps {
  data: {
    dataFreshness: DataFreshness;
    status: 'fresh' | 'stale';
    message: string;
  } | null;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}

export interface DashboardSummary {
  totalRevenue: number;
  totalOrders: number;
  activeCustomers: number;
  productsOrdered: number;
}

export interface TimeSeriesPoint {
  period: string;
  total_sum: number;
  order_count: number;
}

export interface FirmaLagerStat {
  firmanavn?: string;
  lagernavn?: string;
  total_sum: number;
  order_count: number;
}

export interface DashboardAnalytics {
  summary: DashboardSummary;
  timeSeries: TimeSeriesPoint[];
  firma: { data: FirmaLagerStat[] };
  lager: { data: FirmaLagerStat[] };
}
