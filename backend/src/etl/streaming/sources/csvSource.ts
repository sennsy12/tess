import fs from 'fs';
import stream from 'stream';
import zlib from 'zlib';
import { parse } from 'csv-parse';
import { normalizeHeader } from '../transforms.js';
import type { CompressionType } from '../types.js';

function detectDelimiterFromFirstLine(firstLine: string): string {
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  return semicolonCount > commaCount ? ';' : ',';
}

/**
 * Transform that buffers until the first newline, then resolves getDelimiter()
 * with the delimiter detected from that line and pushes the buffered data (first line + rest).
 * Uses a single read stream so the file is not read twice.
 */
class PeekFirstLineTransform extends stream.Transform {
  private buffer = '';
  private delimiterResolved = false;
  private resolveDelimiter!: (delimiter: string) => void;
  readonly getDelimiterPromise: Promise<string>;

  constructor() {
    super({ decodeStrings: false });
    this.getDelimiterPromise = new Promise<string>((resolve) => {
      this.resolveDelimiter = resolve;
    });
  }

  override _transform(
    chunk: Buffer | string,
    encoding: BufferEncoding | 'buffer',
    callback: stream.TransformCallback
  ): void {
    const pushEncoding = encoding === 'buffer' ? undefined : encoding;
    if (this.delimiterResolved) {
      this.push(chunk, pushEncoding as BufferEncoding);
      callback();
      return;
    }
    const str = typeof chunk === 'string' ? chunk : chunk.toString('utf-8');
    this.buffer += str;
    const newlineIdx = this.buffer.indexOf('\n');
    if (newlineIdx >= 0) {
      const firstLine = this.buffer.slice(0, newlineIdx).replace(/\r$/, '');
      const delimiter = detectDelimiterFromFirstLine(firstLine);
      this.delimiterResolved = true;
      this.resolveDelimiter(delimiter);
      this.push(this.buffer, 'utf8');
      this.buffer = '';
    }
    callback();
  }

  override _flush(callback: stream.TransformCallback): void {
    if (this.buffer.length > 0) {
      if (!this.delimiterResolved) {
        const delimiter = detectDelimiterFromFirstLine(this.buffer.replace(/\r$/, ''));
        this.delimiterResolved = true;
        this.resolveDelimiter(delimiter);
      }
      this.push(this.buffer);
    }
    callback();
  }
}

export interface CsvRowSourceOptions {
  /** When resuming, skip this many rows before yielding. */
  skipRows?: number;
  /** When aborted, stop yielding. */
  signal?: AbortSignal;
}

export async function* csvRowSource(
  filePath: string,
  delimiter?: string,
  compression: CompressionType = 'none',
  options: CsvRowSourceOptions = {}
): AsyncGenerator<Record<string, unknown>> {
  const { skipRows = 0, signal } = options;
  let input: NodeJS.ReadableStream = fs.createReadStream(filePath);
  if (compression === 'gzip') input = input.pipe(zlib.createGunzip());
  else if (compression === 'brotli') input = input.pipe(zlib.createBrotliDecompress());

  const peekTransform = new PeekFirstLineTransform();
  input.pipe(peekTransform);

  const resolvedDelimiter =
    delimiter ?? (await peekTransform.getDelimiterPromise);
  const parser = peekTransform.pipe(
    parse({
      delimiter: resolvedDelimiter,
      bom: true,
      trim: true,
      skip_empty_lines: true,
      relax_column_count: true,
      columns: (headers: string[]) => headers.map((h) => normalizeHeader(h.replace(/"/g, ''))),
    })
  );

  let skipped = 0;
  for await (const record of parser) {
    if (signal?.aborted) {
      throw new DOMException('CSV ingest aborted', 'AbortError');
    }
    if (skipped < skipRows) {
      skipped += 1;
      continue;
    }
    yield record as Record<string, unknown>;
  }
}
