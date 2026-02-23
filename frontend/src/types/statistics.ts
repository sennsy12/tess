export type Metric = 'sum' | 'count' | 'quantity';
export type Dimension = 'day' | 'month' | 'year' | 'product' | 'category';
export type ChartType = 'bar' | 'line' | 'pie';

export interface ComparisonData {
  currentTotal: number;
  previousTotal: number;
  deltaPercent: number | null;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StatsTableProps {
  data: any[];
  nameKey: string;
  title: string;
  currencyFormatter: (value: number) => string;
  pagination: PaginationInfo;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  onRowClick?: (row: any) => void;
}

export type StatType = 'kunde' | 'varegruppe' | 'vare' | 'lager' | 'firma';

export interface StatsFiltersProps {
  statType: StatType;
  setStatType: (type: StatType) => void;
  dateRange: { startDate: string; endDate: string };
  setDateRange: (range: { startDate: string; endDate: string }) => void;
  filters: { kundenr: string; varegruppe: string };
  setFilters: (filters: { kundenr: string; varegruppe: string }) => void;
  compareEnabled: boolean;
  setCompareEnabled: (enabled: boolean) => void;
  chartRef: React.RefObject<HTMLDivElement>;
}

export interface StatsChartsProps {
  data: any[];
  nameKey: string;
  title: string;
  currencyFormatter: (value: number) => string;
  comparison?: ComparisonData | null;
}
