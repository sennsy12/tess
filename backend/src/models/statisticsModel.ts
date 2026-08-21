/**
 * Statistics Model
 *
 * Provides aggregated analytics queries over the `ordre` / `ordrelinje`
 * tables, grouped by various dimensions (customer, product, warehouse,
 * company, time). Each method supports date-range filtering, optional
 * customer/category scoping, and server-side pagination.
 *
 * @module models/statisticsModel
 */
import { groupedStatsModel } from './statistics/grouped.js';
import { timeSeriesStatsModel } from './statistics/timeSeries.js';
import { customStatsModel } from './statistics/customStats.js';
import { topStatsModel } from './statistics/top.js';

export {
  StatsFilters,
  PaginatedResult,
} from './statistics/types.js';

export const statisticsModel = {
  ...groupedStatsModel,
  ...timeSeriesStatsModel,
  ...customStatsModel,
  ...topStatsModel,
};
