import { ApiSourceConfig } from '../types.js';

export interface ApiRowSourceOptions {
  /** When resuming, start from this URL instead of config.url. */
  initialUrl?: string;
  /** Called when we have a next-page URL so the pipeline can save it in checkpoint. */
  onResumeState?: (state: Record<string, unknown>) => void;
  /** When aborted, in-flight fetch is aborted and iteration stops. */
  signal?: AbortSignal;
}

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pathGet(value: unknown, path: string | undefined): unknown {
  if (!path) return value;
  return path
    .split('.')
    .filter(Boolean)
    .reduce<unknown>((acc, key) => {
      if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, value);
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retry: RetryConfig
): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const response = await fetch(url, init);
      if (response.ok) return response;
      if (response.status >= 500 && attempt < retry.maxRetries) {
        attempt += 1;
        await sleep(retry.baseDelayMs * Math.pow(2, attempt - 1));
        continue;
      }
      throw new Error(`API request failed with status ${response.status}`);
    } catch (error) {
      if (attempt >= retry.maxRetries) throw error;
      attempt += 1;
      await sleep(retry.baseDelayMs * Math.pow(2, attempt - 1));
    }
  }
}

function normalizeRecords(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.map((item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : { value: item }
    );
  }
  if (data && typeof data === 'object') {
    return [data as Record<string, unknown>];
  }
  return [{ value: data }];
}

export async function* apiRowSource(
  config: ApiSourceConfig,
  options: ApiRowSourceOptions = {}
): AsyncGenerator<Record<string, unknown>> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 20000,
    dataPath = 'data',
    nextPagePath = 'next',
    maxPages = 1000,
    minRequestIntervalMs = 0,
    parallelPages = 1,
  } = config;

  type PageResult = { payload: unknown; nextUrl: string | null };
  const { initialUrl, onResumeState, signal } = options;
  const retry: RetryConfig = { maxRetries: 3, baseDelayMs: 500 };
  const prefetchNext = parallelPages > 1;
  let currentUrl: string | null = initialUrl ?? url;
  let page = 0;
  let lastRequestTime = 0;
  let nextFetchPromise: Promise<PageResult> | null = null;

  async function fetchPage(pageUrl: string): Promise<PageResult> {
    if (signal?.aborted) {
      throw new DOMException('API ingest aborted', 'AbortError');
    }
    if (minRequestIntervalMs > 0 && lastRequestTime > 0) {
      const elapsed = Date.now() - lastRequestTime;
      if (elapsed < minRequestIntervalMs) {
        await sleep(minRequestIntervalMs - elapsed);
      }
    }
    lastRequestTime = Date.now();
    const controller = new AbortController();
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchWithRetry(
        pageUrl,
        {
          method,
          headers: { 'content-type': 'application/json', ...headers },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        },
        retry
      );
      const payload = await response.json();
      const nextValue = pathGet(payload, nextPagePath);
      const nextUrl =
        typeof nextValue === 'string' && nextValue.length > 0 ? nextValue : null;
      return { payload, nextUrl };
    } finally {
      clearTimeout(timeout);
    }
  }

  while (currentUrl && page < maxPages) {
    if (signal?.aborted) {
      throw new DOMException('API ingest aborted', 'AbortError');
    }
    page += 1;
    const nextPromise: Promise<PageResult> = nextFetchPromise ?? fetchPage(currentUrl);
    nextFetchPromise = null;
    const { payload, nextUrl } = await nextPromise;

    if (nextUrl && onResumeState) {
      onResumeState({ nextUrl });
    }
    if (prefetchNext && nextUrl) {
      nextFetchPromise = fetchPage(nextUrl);
    }
    currentUrl = nextUrl;

    const dataValue = pathGet(payload, dataPath);
    for (const row of normalizeRecords(dataValue)) {
      yield row;
    }
  }
}
