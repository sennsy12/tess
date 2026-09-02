/**
 * Final merge statements: staging → real table.
 *
 * @module db/copy/merge
 */
import type { PoolClient } from 'pg';
import { quoteIdentifier, assertSafeIdentifiers } from '../identifiers.js';

type Queryable = { query: PoolClient['query'] };

/** INSERT … SELECT … ON CONFLICT DO NOTHING, returns inserted count. */
export async function mergeStagingDoNothing(
  client: Queryable,
  tableName: string,
  stagingName: string,
  columns: string[],
): Promise<number> {
  const result = await client.query(`
          INSERT INTO ${tableName} (${columns.join(', ')})
          SELECT ${columns.join(', ')} FROM ${stagingName}
          ON CONFLICT DO NOTHING
        `);
  return result.rowCount || 0;
}

/** INSERT … SELECT … ON CONFLICT (keys) DO UPDATE, returns inserted count. */
export async function mergeStagingUpsert(
  client: Queryable,
  tableName: string,
  stagingName: string,
  columns: string[],
  validColSet: Set<string>,
  upsertKeyColumns?: string[],
  upsertUpdateColumns?: string[],
): Promise<number> {
  const keyCols = upsertKeyColumns?.length ? upsertKeyColumns : [];
  if (keyCols.length === 0) {
    throw new Error('upsert requires upsertKeyColumns');
  }
  assertSafeIdentifiers('upsert key column', keyCols, validColSet);
  const updateCols = upsertUpdateColumns?.length
    ? upsertUpdateColumns
    : columns.filter((c) => !keyCols.includes(c));
  assertSafeIdentifiers('upsert update column', updateCols, validColSet);
  const setClause =
    updateCols.length > 0
      ? updateCols.map((c) => `${quoteIdentifier(c)} = EXCLUDED.${quoteIdentifier(c)}`).join(', ')
      : null;
  const conflictClause = `ON CONFLICT (${keyCols.map(quoteIdentifier).join(', ')})`;
  const doUpdate = setClause ? `DO UPDATE SET ${setClause}` : 'DO NOTHING';
  const result = await client.query(`
          INSERT INTO ${tableName} (${columns.join(', ')})
          SELECT ${columns.join(', ')} FROM ${stagingName}
          ${conflictClause} ${doUpdate}
        `);
  return result.rowCount || 0;
}
