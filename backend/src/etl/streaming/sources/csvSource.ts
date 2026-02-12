import fs from 'fs';
import readline from 'readline';
import { parse } from 'csv-parse';
import { normalizeHeader } from '../transforms.js';

async function detectSeparator(filePath: string): Promise<string> {
  const stream = fs.createReadStream(filePath);
  const rl = readline.createInterface({ input: stream, terminal: false });

  const firstLine = await new Promise<string>((resolve, reject) => {
    rl.once('line', (line) => {
      rl.close();
      stream.destroy();
      resolve(line);
    });
    rl.once('error', reject);
    stream.once('error', reject);
  });

  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

export async function* csvRowSource(filePath: string, delimiter?: string): AsyncGenerator<Record<string, unknown>> {
  const resolvedDelimiter = delimiter || await detectSeparator(filePath);
  const parser = fs.createReadStream(filePath).pipe(
    parse({
      delimiter: resolvedDelimiter,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      columns: (headers: string[]) => headers.map((h) => normalizeHeader(h.replace(/"/g, ''))),
    })
  );

  for await (const record of parser) {
    yield record as Record<string, unknown>;
  }
}
