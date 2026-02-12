import fs from 'fs';
import readline from 'readline';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray.js';
import { JsonInputMode } from '../types.js';

function asObjectRow(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

async function* ndjsonSource(filePath: string): AsyncGenerator<Record<string, unknown>> {
  const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    yield asObjectRow(JSON.parse(trimmed));
  }
}

async function* jsonArraySource(filePath: string): AsyncGenerator<Record<string, unknown>> {
  const input = fs.createReadStream(filePath);
  const jsonParser = parser();
  const arrayStream = streamArray();
  input.pipe(jsonParser).pipe(arrayStream);

  for await (const item of arrayStream as AsyncIterable<{ key: number; value: unknown }>) {
    yield asObjectRow(item.value);
  }
}

export async function* jsonRowSource(
  filePath: string,
  mode: JsonInputMode = 'array'
): AsyncGenerator<Record<string, unknown>> {
  if (mode === 'ndjson') {
    yield* ndjsonSource(filePath);
    return;
  }
  yield* jsonArraySource(filePath);
}
