import { ApiSourceConfig } from '../types.js';

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

export async function* apiRowSource(config: ApiSourceConfig): AsyncGenerator<Record<string, unknown>> {
  const {
    url,
    method = 'GET',
    headers = {},
    body,
    timeoutMs = 20000,
    dataPath = 'data',
    nextPagePath = 'next',
    maxPages = 1000,
  } = config;

  const retry: RetryConfig = { maxRetries: 3, baseDelayMs: 500 };
  let currentUrl: string | null = url;
  let page = 0;

  while (currentUrl && page < maxPages) {
    page += 1;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchWithRetry(currentUrl, {
        method,
        headers: { 'content-type': 'application/json', ...headers },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      }, retry);
      const payload = await response.json();

      const dataValue = pathGet(payload, dataPath);
      for (const row of normalizeRecords(dataValue)) {
        yield row;
      }

      const nextValue = pathGet(payload, nextPagePath);
      currentUrl = typeof nextValue === 'string' && nextValue.length > 0 ? nextValue : null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
