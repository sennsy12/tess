/**
 * COPY text-protocol line encoder: one row → one `\t`-separated line.
 *
 * NULL → `\N`, special chars (`\t \n \r \`) escaped. Fast path skips
 * regex work when the value contains no special characters.
 *
 * @module db/copy/encodeCopyLine
 */

/** Encode a single row of values as one COPY text line (incl. `\n`). */
export function encodeCopyLine(row: unknown[]): string {
  let line = '';
  for (let j = 0; j < row.length; j++) {
    if (j > 0) line += '\t';
    const val = row[j] as unknown;
    if (val === null || val === undefined) {
      line += '\\N';
      continue;
    }
    const str = typeof val === 'string' ? val : String(val);
    if (/[\t\n\r\\]/.test(str)) {
      line += str
        .replace(/\\/g, '\\\\')
        .replace(/\t/g, '\\t')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r');
    } else {
      line += str;
    }
  }
  return line + '\n';
}

/** Count COPY text lines in a chunk (each line is one row). */
export function countCopyLines(chunk: string): number {
  if (!chunk || typeof chunk !== 'string') return 0;
  const matches = chunk.match(/\n/g);
  return matches ? matches.length : chunk.trim() ? 1 : 0;
}
