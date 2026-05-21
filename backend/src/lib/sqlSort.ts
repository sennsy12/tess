/** Whitelist-based ORDER BY builder for server-side table sorting. */
export function buildOrderByClause(
  allowedColumns: Record<string, string>,
  sortBy: string | undefined,
  sortDir: 'asc' | 'desc' | undefined,
  defaultExpression: string,
): string {
  const column = sortBy && allowedColumns[sortBy] ? allowedColumns[sortBy] : defaultExpression;
  const direction = sortDir === 'asc' ? 'ASC' : 'DESC';
  return `${column} ${direction}`;
}
