import fs from 'fs';
import zlib from 'zlib';
import readline from 'readline';
import { parser } from 'stream-json';
import { streamArray } from 'stream-json/streamers/StreamArray.js';
import { JsonInputMode } from '../types.js';
import type { CompressionType } from '../types.js';
import { ValidationError } from '../../../middleware/errorHandler.js';

function asObjectRow(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return { value };
}

export interface JsonRowSourceOptions {
  /** When resuming, skip this many rows before yielding. */
  skipRows?: number;
  /** When aborted, stop yielding. */
  signal?: AbortSignal;
}

async function* ndjsonSource(
  filePath: string,
  compression: CompressionType,
  skipRows: number,
  signal?: AbortSignal
): AsyncGenerator<Record<string, unknown>> {
  let stream: NodeJS.ReadableStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  if (compression === 'gzip') stream = stream.pipe(zlib.createGunzip());
  else if (compression === 'brotli') stream = stream.pipe(zlib.createBrotliDecompress());
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNumber = 0;
  let skipped = 0;
  for await (const line of rl) {
    if (signal?.aborted) {
      throw new DOMException('JSON ingest aborted', 'AbortError');
    }
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const row = asObjectRow(JSON.parse(trimmed));
      if (skipped < skipRows) {
        skipped += 1;
        continue;
      }
      yield row;
    } catch (err) {
      throw new ValidationError(
        `Invalid JSON at line ${lineNumber}: ${(err as Error).message}`
      );
    }
  }
}

async function* jsonArraySource(
  filePath: string,
  compression: CompressionType,
  skipRows: number,
  signal?: AbortSignal
): AsyncGenerator<Record<string, unknown>> {
  let input: NodeJS.ReadableStream = fs.createReadStream(filePath);
  if (compression === 'gzip') input = input.pipe(zlib.createGunzip());
  else if (compression === 'brotli') input = input.pipe(zlib.createBrotliDecompress());
  const jsonParser = parser();
  const arrayStream = streamArray();
  input.pipe(jsonParser).pipe(arrayStream);

  let skipped = 0;
  for await (const item of arrayStream as AsyncIterable<{ key: number; value: unknown }>) {
    if (signal?.aborted) {
      throw new DOMException('JSON ingest aborted', 'AbortError');
    }
    if (skipped < skipRows) {
      skipped += 1;
      continue;
    }
    yield asObjectRow(item.value);
  }
}

export async function* jsonRowSource(
  filePath: string,
  mode: JsonInputMode = 'array',
  compression: CompressionType = 'none',
  options: JsonRowSourceOptions = {}
): AsyncGenerator<Record<string, unknown>> {
  const { skipRows = 0, signal } = options;
  if (mode === 'ndjson') {
    yield* ndjsonSource(filePath, compression, skipRows, signal);
    return;
  }
  yield* jsonArraySource(filePath, compression, skipRows, signal);
}
