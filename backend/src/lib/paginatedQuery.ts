type RowWithWindowCount = Record<string, unknown> & { _total_count?: number | string };

/**
 * Split rows from a `COUNT(*) OVER()` paginated query into data + total.
 * Strips the window-count column so it is not returned to API clients.
 */
export function extractWindowCountPage<T extends Record<string, unknown>>(
  rows: Array<T & RowWithWindowCount>,
): { data: T[]; total: number } {
  const total = rows.length > 0 ? Number(rows[0]._total_count ?? 0) : 0;
  const data = rows.map(({ _total_count: _tc, ...row }) => row as T);
  return { data, total };
}
