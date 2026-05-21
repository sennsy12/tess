export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedListResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Standard paginated list envelope for all list endpoints. */
export function buildListResponse<T>(
  data: T[],
  options: { page: number; limit: number; total: number },
): PaginatedListResponse<T> {
  const { page, limit, total } = options;
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
    },
  };
}
