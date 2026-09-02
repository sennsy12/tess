/**
 * Auto-provision dimension rows from the staging table so FK constraints
 * hold before the final merge (kunde / firma / valuta / vare / lager).
 *
 * @module db/copy/dimensions
 */
import type { PoolClient } from 'pg';

type Queryable = { query: PoolClient['query'] };

/** Insert missing dimensions referenced by the staged rows. */
export async function provisionDimensionsFromStaging(
  client: Queryable,
  stagingName: string,
  columns: string[],
): Promise<void> {
  // stagingName is server-generated (temp_*); columns are pre-validated.
  if (columns.includes('kundenr')) {
    await client.query(`
          INSERT INTO public.kunde (kundenr, kundenavn)
          SELECT DISTINCT kundenr, 'Auto-generert' FROM ${stagingName}
          WHERE kundenr IS NOT NULL
          ON CONFLICT (kundenr) DO NOTHING
        `);
  }
  if (columns.includes('firmaid')) {
    await client.query(`
          INSERT INTO public.firma (firmaid, firmanavn)
          SELECT DISTINCT firmaid, 'Firma ' || firmaid FROM ${stagingName}
          WHERE firmaid IS NOT NULL
          ON CONFLICT (firmaid) DO NOTHING
        `);
  }
  if (columns.includes('valutaid')) {
    await client.query(`
          INSERT INTO public.valuta (valutaid)
          SELECT DISTINCT valutaid FROM ${stagingName}
          WHERE valutaid IS NOT NULL
          ON CONFLICT (valutaid) DO NOTHING
        `);
  }
  if (columns.includes('varekode')) {
    await client.query(`
          INSERT INTO public.vare (varekode, varenavn)
          SELECT DISTINCT varekode, 'Produkt ' || varekode FROM ${stagingName}
          WHERE varekode IS NOT NULL
          ON CONFLICT (varekode) DO NOTHING
        `);
  }
  if (columns.includes('lagernavn') && columns.includes('firmaid')) {
    await client.query(`
          INSERT INTO public.lager (lagernavn, firmaid)
          SELECT DISTINCT lagernavn, firmaid FROM ${stagingName}
          WHERE lagernavn IS NOT NULL AND firmaid IS NOT NULL
          ON CONFLICT (lagernavn, firmaid) DO NOTHING
        `);
  }
}
