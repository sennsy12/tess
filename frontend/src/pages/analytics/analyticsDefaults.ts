import { shiftDaysLocal, toDateInputLocal } from '../../lib/formatters';
import type { AnalyticsConfig } from './analyticsTypes';

export function createDefaultAnalyticsConfig(): AnalyticsConfig {
  return {
    metric: 'sum',
    dimension: 'month',
    chartType: 'bar',
    startDate: shiftDaysLocal(29),
    endDate: toDateInputLocal(new Date()),
    search: '',
  };
}
