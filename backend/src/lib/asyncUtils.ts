import { AppError } from '../middleware/errorHandler.js';

export interface WithRetryOptions {
  attempts?: number;
  backoffMs?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
}

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'Operation',
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);

    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {},
): Promise<T> {
  const attempts = options.attempts ?? 3;
  const backoffMs = options.backoffMs ?? 500;
  const shouldRetry = options.shouldRetry ?? isTransientError;

  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      await sleep(backoffMs * attempt);
    }
  }

  throw lastError;
}

/** Returns true for HTTP status codes that are safe to retry. */
export function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

/** Returns true for transient network/service failures worth retrying. */
export function isTransientError(error: unknown): boolean {
  if (error instanceof AppError) {
    return isRetryableHttpStatus(error.statusCode);
  }
  if (error instanceof TypeError) {
    return true;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }
  if (error instanceof Error && /timed out/i.test(error.message)) {
    return false;
  }
  return false;
}
