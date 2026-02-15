/**
 * Encode COPY text format directly into a Buffer to avoid per-row string/array allocations.
 * Same escaping rules as formatCopyValue: \ -> \\, \t -> \t, \n -> \n, \r -> \r, null -> \N.
 */

/** Append one COPY field value at buf[offset], return new offset. */
export function writeCopyValue(buf: Buffer, offset: number, value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    buf.write('\\N', offset);
    return offset + 2;
  }
  const str = String(value);
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (c === '\\') {
      buf.write('\\\\', offset);
      offset += 2;
    } else if (c === '\t') {
      buf.write('\\t', offset);
      offset += 2;
    } else if (c === '\n') {
      buf.write('\\n', offset);
      offset += 2;
    } else if (c === '\r') {
      buf.write('\\r', offset);
      offset += 2;
    } else {
      offset += buf.write(c, offset);
    }
  }
  return offset;
}

/** Append tab then field value; returns new offset. Call once per field after the first. */
export function writeCopyField(buf: Buffer, offset: number, value: string | number | null | undefined): number {
  buf[offset++] = 0x09; // \t
  return writeCopyValue(buf, offset, value);
}

/** Append row terminator \n; returns new offset. */
export function writeCopyRowEnd(buf: Buffer, offset: number): number {
  buf[offset++] = 0x0a; // \n
  return offset;
}

const POOL_SIZE = 4;
const BUFFER_SIZE = 1024 * 1024; // 1MB
const pool: Buffer[] = [];

function allocBuffer(): Buffer {
  return Buffer.allocUnsafe(BUFFER_SIZE);
}

/** Get a buffer from the pool (or allocate if pool empty). */
export function takeBuffer(): Buffer {
  return pool.pop() ?? allocBuffer();
}

/** Return a buffer to the pool for reuse (call with the original buffer from takeBuffer). */
export function returnBuffer(buf: Buffer): void {
  if (pool.length < POOL_SIZE) {
    pool.push(buf);
  }
}

export const COPY_BUFFER_SIZE = BUFFER_SIZE;
