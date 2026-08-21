/**
 * SQL identifier safety helpers.
 *
 * Identifiers (table/column names) cannot be bound as query parameters —
 * wherever they are interpolated into SQL text they MUST be validated
 * and/or quoted first.
 *
 * @module db/identifiers
 */

/** Strict pattern for plain PostgreSQL identifiers (unquoted). */
export const SAFE_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Quote a PostgreSQL identifier so it cannot break out of the SQL text.
 * Embedded double quotes are escaped by doubling them.
 */
export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/**
 * Assert that every identifier exists in the target table's column set.
 *
 * Column/key names are interpolated into SQL (identifiers cannot be bound as
 * query parameters), so they MUST be validated against the actual table
 * schema before use. Anything not present in `validColumns` is rejected —
 * this closes the injection vector for request-supplied upsert key/update
 * columns.
 */
export function assertSafeIdentifiers(
  label: string,
  names: string[],
  validColumns: Set<string>
): void {
  const invalid = names.filter((n) => !validColumns.has(n));
  if (invalid.length > 0) {
    throw new Error(
      `Invalid ${label} for table: ${invalid.map((c) => JSON.stringify(c)).join(', ')}`
    );
  }
}
