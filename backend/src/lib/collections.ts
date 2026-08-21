export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length === 0) return [];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

export function splitEvenly<T>(items: T[], parts: number): T[][] {
  if (parts <= 0 || items.length === 0) return [];
  const size = Math.ceil(items.length / parts);
  return chunk(items, size);
}

export async function asyncPool<T, R>(
  limit: number,
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (limit <= 0 || items.length === 0) return [];

  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await fn(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export function groupBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Record<K, T[]> {
  const result = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    if (!result[k]) result[k] = [];
    result[k].push(item);
  }
  return result;
}

export function keyBy<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): Record<K, T> {
  const result = {} as Record<K, T>;
  for (const item of items) {
    result[key(item)] = item;
  }
  return result;
}

export function uniqueBy<T>(items: T[], key: (item: T) => unknown): T[] {
  const seen = new Set<unknown>();
  const result: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(item);
  }
  return result;
}

const nbCollator = new Intl.Collator('nb-NO');

export function sortByNb<T>(items: T[], key: (item: T) => string): T[] {
  return [...items].sort((a, b) => nbCollator.compare(key(a), key(b)));
}
