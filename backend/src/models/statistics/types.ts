/** Common filter parameters shared across all statistics queries. */
export interface StatsFilters {
  startDate?: string;
  endDate?: string;
  varegruppe?: string;
  kundenr?: string;
  search?: string;
  groupBy?: string;
  page?: number;
  limit?: number;
}

/** Standard paginated response envelope used by all statistics endpoints. */
export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
