import { useQuery } from '@tanstack/react-query';import { statisticsApi } from '../../lib/api';
import { analyticsKeys } from '../../lib/queryKeys';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { AnalyticsConfig, AnalyticsDataPoint, AnalyticsScope } from './analyticsTypes';

export function useAnalyticsQuery(scope: AnalyticsScope, config: AnalyticsConfig) {
  const debouncedSearch = useDebouncedValue(config.search, 300);

  const queryConfig = {
    metric: config.metric,
    dimension: config.dimension,
    startDate: config.startDate,
    endDate: config.endDate,
    search: debouncedSearch,
  };

  return useQuery<AnalyticsDataPoint[]>({
    queryKey: analyticsKeys.custom(scope, queryConfig),
    queryFn: async () => {
      const response = await statisticsApi.getCustom({
        metric: config.metric,
        dimension: config.dimension,
        startDate: config.startDate || undefined,
        endDate: config.endDate || undefined,
        search: debouncedSearch || undefined,
      });
      return response.data;
    },
  });
}
