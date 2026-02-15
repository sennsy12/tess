import { Readable } from 'stream';

const DEFAULT_HIGH_WATER_MARK = 1024;

/**
 * Converts an async iterable into a Node.js Readable stream with proper backpressure.
 * The consumer (e.g. COPY stream) will pause when its buffer is full; we stop pulling
 * from the generator until 'drain' is emitted.
 */
export function readableFromAsyncIterator<T>(
  asyncIterator: AsyncIterable<T>,
  options: { highWaterMark?: number; objectMode?: boolean } = {}
): Readable {
  const highWaterMark = options.highWaterMark ?? DEFAULT_HIGH_WATER_MARK;
  const objectMode = options.objectMode ?? false;

  const iterator = asyncIterator[Symbol.asyncIterator]();

  return new Readable({
    objectMode,
    highWaterMark,
    async read(this: Readable) {
      try {
        const { value, done } = await iterator.next();
        if (done) {
          this.push(null);
          return;
        }
        if (!this.push(value)) {
          // Consumer buffer full; backpressure. Next read() will pull again.
          return;
        }
      } catch (err) {
        this.destroy(err as Error);
      }
    },
  });
}
