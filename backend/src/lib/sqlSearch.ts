/** Escape PostgreSQL LIKE/ILIKE metacharacters in user-provided search text. */
function escapeLikeMetacharacters(term: string): string {
  return term.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

/**
 * Build a safe `ILIKE` contains pattern (`%term%`) for parameterized queries.
 * Escapes `%`, `_`, and `\` so user input is matched literally.
 */
export function toIlikeContains(term: string): string {
  const trimmed = term.trim();
  if (!trimmed) return '%';
  return `%${escapeLikeMetacharacters(trimmed)}%`;
}
