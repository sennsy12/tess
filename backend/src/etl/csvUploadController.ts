import fs from 'fs';
import readline from 'readline';
import { runStreamingEtl } from './streaming/pipeline.js';
import { EtlTableName } from './streaming/types.js';
import { normalizeHeader } from './streaming/transforms.js';

const SUPPORTED_TABLES: EtlTableName[] = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

async function detectSeparatorAndHeaders(filePath: string): Promise<{ separator: string; headers: string[] }> {
  const fileStream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: fileStream, terminal: false });

  const firstLine = await new Promise<string>((resolve, reject) => {
    rl.once('line', (line) => {
      rl.close();
      fileStream.destroy();
      resolve(line);
    });
    rl.once('error', reject);
    fileStream.once('error', reject);
  });

  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const separator = semicolonCount > commaCount ? ';' : ',';
  const headers = firstLine
    .split(separator)
    .map((h) => normalizeHeader(h.replace(/"/g, '')));
  return { separator, headers };
}

function detectTargetTable(headers: string[]): EtlTableName {
  if (headers.includes('ordrenr') && headers.includes('linjenr')) return 'ordrelinje';

  const candidates: Record<EtlTableName, string[]> = {
    ordre: ['ordrenr', 'dato', 'kundenr'],
    ordrelinje: ['linjenr', 'ordrenr', 'vare'],
    kunde: ['kundenr', 'kundenavn'],
    vare: ['vare', 'varenavn'],
    firma: ['firma'],
    lager: ['lager', 'firma'],
  };

  for (const table of SUPPORTED_TABLES) {
    const score = candidates[table].filter((h) => headers.includes(h)).length;
    if (score >= Math.min(2, candidates[table].length)) return table;
  }

  throw new Error(`Kunne ikke identifisere tabell fra headere: ${headers.join(', ')}`);
}

/**
 * Uploads CSV to inferred/selected table with streaming COPY pipeline.
 */
export async function uploadCsvToTable(
  filePath: string,
  providedTable?: string
): Promise<{ duration: number; table: string; rowCount: number; attemptedRows: number; rejectedRows: number }> {
  const startTime = Date.now();
  const { separator, headers } = await detectSeparatorAndHeaders(filePath);
  const detectedTable = providedTable ? (providedTable as EtlTableName) : detectTargetTable(headers);

  if (!SUPPORTED_TABLES.includes(detectedTable)) {
    throw new Error(`Unsupported table: ${detectedTable}`);
  }

  let insertedRows = 0;
  let attemptedRows = 0;
  let rejectedRows = 0;

  // For combined order+line CSV (one row per order line, with order fields repeated):
  // Insert ordre first (one row per CSV row; ON CONFLICT DO NOTHING dedupes by ordrenr),
  // then ordrelinje. Order-level fields (e.g. sum) use the first row per ordrenr.
  if (!providedTable && detectedTable === 'ordrelinje' && headers.includes('ordrenr') && headers.includes('linjenr')) {
    await runStreamingEtl({
      sourceType: 'csv',
      table: 'ordre',
      csv: { filePath, delimiter: separator },
      onConflict: 'nothing',
      strictMode: false,
    });
    const lineResult = await runStreamingEtl({
      sourceType: 'csv',
      table: 'ordrelinje',
      csv: { filePath, delimiter: separator },
      onConflict: 'nothing',
      strictMode: false,
    });
    insertedRows = lineResult.insertedRows;
    attemptedRows = lineResult.attemptedRows;
    rejectedRows = lineResult.rejectedRows;
  } else {
    const result = await runStreamingEtl({
      sourceType: 'csv',
      table: detectedTable,
      csv: { filePath, delimiter: separator },
      onConflict: 'nothing',
      strictMode: false,
    });
    insertedRows = result.insertedRows;
    attemptedRows = result.attemptedRows;
    rejectedRows = result.rejectedRows;
  }

  const duration = Date.now() - startTime;
  return {
    duration,
    table: detectedTable,
    rowCount: insertedRows,
    attemptedRows,
    rejectedRows,
  };
}
