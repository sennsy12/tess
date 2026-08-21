import type { Metric, Dimension, ChartType } from '../../types/statistics';

export type { Metric, Dimension, ChartType };

export interface AnalyticsConfig {
  metric: Metric;
  dimension: Dimension;
  chartType: ChartType;
  startDate: string;
  endDate: string;
  search: string;
}

export interface AnalyticsDataPoint {
  label: string;
  value: number;
}

export interface AnalyticsPreset {
  id: string;
  label: string;
  description: string;
  bestFor?: string;
  config: AnalyticsConfig;
}

export type AnalyticsScope = 'kunde-advanced-analytics' | 'admin-advanced-analytics';

export interface AdvancedAnalyticsPageProps {
  title: string;
  scope: AnalyticsScope;
  presets: AnalyticsPreset[];
  exportFilenamePrefix: string;
  savedViewsTitle: string;
  savedViewsDescription: string;
  enableSharedViews?: boolean;
}
