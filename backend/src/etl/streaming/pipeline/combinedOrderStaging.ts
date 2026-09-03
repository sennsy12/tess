import { once } from 'events';
import { getClient } from '../../../db/index.js';
import { quoteIdentifier, assertSafeIdentifiers } from '../../../db/identifiers.js';
import { getTableColumns } from '../../../db/copyLoaders.js';

/**
 * Shared staging helpers for combined order/order-line ingest.
 *
 * Both the CSV and XLSX combined loaders fan one source stream out into two
 * parallel COPY streams (ordre + ordrelinje) on separate connections, then
 * merge in FK-safe order (ordre commits before ordrelinje merges).
 *
 * @module etl/streaming/pipeline/combinedOrderStaging
 */

export interface CopyTarget {
  tableName: string;
  columns: string[];
  tempTable: string;
}

export type StagedClient = Awaited<ReturnType<typeof getClient>>;
export type CopyStream = NodeJS.WritableStream & { end(cb?: () => void): void };

export const drain = async (stream: CopyStream): Promise<void> => {
  await once(stream as never, 'drain');
};

/**
 * Provision missing dimension rows referenced by the staging table, mirroring
 * the behavior of copyFromLineStream's auto-provisioning step.
 */
export async function provisionDimensions(
  client: StagedClient,
  tempTable: string,
  columns: string[]
): Promise<void> {
  if (columns.includes('kundenr')) {
    await client.query(`
      INSERT INTO public.kunde (kundenr, kundenavn)
      SELECT DISTINCT kundenr, 'Auto-generert' FROM ${tempTable}
      WHERE kundenr IS NOT NULL
      ON CONFLICT (kundenr) DO NOTHING
    `);
  }
  if (columns.includes('firmaid')) {
    await client.query(`
      INSERT INTO public.firma (firmaid, firmanavn)
      SELECT DISTINCT firmaid, 'Firma ' || firmaid FROM ${tempTable}
      WHERE firmaid IS NOT NULL
      ON CONFLICT (firmaid) DO NOTHING
    `);
  }
  if (columns.includes('valutaid')) {
    await client.query(`
      INSERT INTO public.valuta (valutaid)
      SELECT DISTINCT valutaid FROM ${tempTable}
      WHERE valutaid IS NOT NULL
      ON CONFLICT (valutaid) DO NOTHING
    `);
  }
  if (columns.includes('varekode')) {
    await client.query(`
      INSERT INTO public.vare (varekode, varenavn)
      SELECT DISTINCT varekode, 'Produkt ' || varekode FROM ${tempTable}
      WHERE varekode IS NOT NULL
      ON CONFLICT (varekode) DO NOTHING
    `);
  }
  if (columns.includes('lagernavn') && columns.includes('firmaid')) {
    await client.query(`
      INSERT INTO public.lager (lagernavn, firmaid)
      SELECT DISTINCT lagernavn, firmaid FROM ${tempTable}
      WHERE lagernavn IS NOT NULL AND firmaid IS NOT NULL
      ON CONFLICT (lagernavn, firmaid) DO NOTHING
    `);
  }
}

/**
 * Begin a transaction, create a constraint-free temp staging table and open a
 * COPY ... FROM STDIN stream on it. The transaction stays OPEN; the caller
 * feeds the returned stream and later merges + commits.
 */
export async function beginStagingCopy(
  client: StagedClient,
  target: CopyTarget
): Promise<CopyStream> {
  const { tableName, columns, tempTable } = target;
  const copyStreams = await import('pg-copy-streams');

  await client.query('BEGIN');
  await client.query(`CREATE TEMP TABLE ${tempTable} (LIKE ${tableName} INCLUDING DEFAULTS) ON COMMIT DROP`);
  const validColSet = await getTableColumns(tableName);
  assertSafeIdentifiers(`combined-${tableName} columns`, columns, validColSet);
  // Relax NOT NULL on columns the source does not provide so staging stays light.
  for (const col of [...validColSet].filter((c) => !columns.includes(c))) {
    await client.query(`ALTER TABLE ${tempTable} ALTER COLUMN ${quoteIdentifier(col)} DROP NOT NULL`);
  }

  const quotedColumns = columns.map(quoteIdentifier).join(', ');
  return client.query(
    copyStreams.from(`COPY ${tempTable} (${quotedColumns}) FROM STDIN WITH (FORMAT text, NULL '\\N')`)
  );
}

/** Resolve when the COPY stream finishes (server consumed everything). */
export function waitForCopyFinish(stream: CopyStream): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.once('error', reject);
    stream.once('finish', () => resolve());
  });
}

export function makeTempTableName(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function rollbackQuietly(client: StagedClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    /* connection already aborted */
  }
}
