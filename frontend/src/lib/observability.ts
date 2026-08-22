const API_URL = import.meta.env.VITE_API_URL || '/api';
const ENDPOINT = `${API_URL}/client-events`;
const FLUSH_INTERVAL_MS = 10_000;
const MAX_QUEUE_SIZE = 100;
const DEDUP_WINDOW_MS = 30_000;
const MAX_INTERACTION_SAMPLES = 50;
const MAX_EVENTS_PER_SESSION = 150;
const SESSION_ID_KEY = 'tess-session-id';

export type VitalRating = 'good' | 'needs-improvement' | 'poor';

interface ClientEvent {
  type: 'error' | 'vital' | 'event';
  name: string;
  message?: string;
  stack?: string;
  value?: number;
  rating?: VitalRating;
  context?: Record<string, unknown>;
  path: string;
  ts: number;
}

interface TelemetryPayload {
  sessionId: string;
  release: string;
  events: ClientEvent[];
}

interface LcpEntry {
  startTime: number;
}

interface LayoutShiftEntry {
  value: number;
  hadRecentInput: boolean;
}

interface EventTimingEntry {
  interactionId: number;
  duration: number;
}

let initialized = false;
let queue: ClientEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sessionEventCount = 0;
let latestLcp = 0;
let cumulativeLayoutShift = 0;
const interactionDurations: number[] = [];
const lastSentAt = new Map<string, number>();

export const RELEASE = import.meta.env.VITE_APP_VERSION || import.meta.env.VITE_COMMIT_SHA || 'dev';
const TELEMETRY_ENABLED = import.meta.env.PROD && typeof window !== 'undefined';

function createSessionId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
  } catch {
    // fall through to non-crypto fallback
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = createSessionId();
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return createSessionId();
  }
}

function shouldSend(dedupKey: string): boolean {
  const now = Date.now();
  const last = lastSentAt.get(dedupKey);
  if (last !== undefined && now - last < DEDUP_WINDOW_MS) return false;
  if (sessionEventCount >= MAX_EVENTS_PER_SESSION) return false;
  lastSentAt.set(dedupKey, now);
  return true;
}

function enqueue(event: Omit<ClientEvent, 'ts' | 'path'>): void {
  const dedupKey = `${event.type}:${event.name}:${event.message ?? ''}`;
  if (!shouldSend(dedupKey)) return;

  queue.push({ ...event, path: window.location.pathname, ts: Date.now() });
  sessionEventCount += 1;

  if (queue.length > MAX_QUEUE_SIZE) {
    queue = queue.slice(-MAX_QUEUE_SIZE);
  }
}

function deliver(payload: TelemetryPayload): void {
  const body = JSON.stringify(payload);
  try {
    if (typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(ENDPOINT, blob)) return;
    }
  } catch {
    // fall through to fetch
  }
  fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => undefined);
}

function flush(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (queue.length === 0) return;
  const batch = queue;
  queue = [];
  deliver({ sessionId: getSessionId(), release: RELEASE, events: batch });
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(flush, FLUSH_INTERVAL_MS);
}

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

function isCancellation(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; name?: unknown; message?: unknown };
    if (candidate.code === 'ERR_CANCELED') return true;
    if (candidate.name === 'AbortError') return true;
    if (candidate.name === 'CanceledError') return true;
    if (typeof candidate.message === 'string' && candidate.message.toLowerCase() === 'canceled') {
      return true;
    }
  }
  return false;
}

export function reportError(error: unknown, context?: Record<string, unknown>): void {
  const { message, stack } = normalizeError(error);
  if (isCancellation(error)) return;

  if (!TELEMETRY_ENABLED) {
    console.debug('[telemetry] error', message, context ?? {});
    return;
  }
  enqueue({ type: 'error', name: 'client_error', message, stack, context });
  scheduleFlush();
}

export function reportEvent(name: string, context?: Record<string, unknown>): void {
  if (!TELEMETRY_ENABLED) {
    console.debug('[telemetry] event', name, context ?? {});
    return;
  }
  enqueue({ type: 'event', name, context });
  scheduleFlush();
}

export function isServerError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status;
    return typeof status === 'number' ? status >= 500 : false;
  }
  return true;
}

export function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    const status = (error as { response?: { status?: unknown } }).response?.status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function ratingFor(value: number, goodBelow: number, poorAbove: number): VitalRating {
  if (value <= goodBelow) return 'good';
  if (value > poorAbove) return 'poor';
  return 'needs-improvement';
}

function recordVital(name: 'lcp' | 'cls' | 'inp', value: number): void {
  const thresholds = {
    lcp: { good: 2500, poor: 4000 },
    cls: { good: 0.1, poor: 0.25 },
    inp: { good: 200, poor: 500 },
  }[name];

  const rating = ratingFor(value, thresholds.good, thresholds.poor);
  if (!TELEMETRY_ENABLED) return;
  enqueue({
    type: 'vital',
    name,
    value: Number(value.toFixed(2)),
    rating,
    context: { release: RELEASE },
  });
  scheduleFlush();
}

function observeVitals(): void {
  if (typeof PerformanceObserver === 'undefined') return;

  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as LcpEntry[];
      const last = entries[entries.length - 1];
      if (last && last.startTime !== latestLcp) {
        latestLcp = last.startTime;
        recordVital('lcp', latestLcp);
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {
    // unsupported entry type in this browser
  }

  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as LayoutShiftEntry[];
      for (const entry of entries) {
        if (!entry.hadRecentInput) {
          cumulativeLayoutShift += entry.value;
        }
      }
      recordVital('cls', cumulativeLayoutShift);
    }).observe({ type: 'layout-shift', buffered: true });
  } catch {
    // unsupported entry type in this browser
  }

  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries() as unknown as EventTimingEntry[];
      for (const entry of entries) {
        if (entry.interactionId && entry.duration > 0) {
          interactionDurations.push(entry.duration);
          if (interactionDurations.length > MAX_INTERACTION_SAMPLES) {
            interactionDurations.shift();
          }
        }
      }
    }).observe({ type: 'event', buffered: true, durationThreshold: 16 } as PerformanceObserverInit);
  } catch {
    // unsupported entry type in this browser
  }

  try {
    const [navigation] = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navigation?.responseStart && navigation.requestStart) {
      enqueueTtfb(navigation.responseStart - navigation.requestStart);
    }
  } catch {
    // navigation timing unavailable
  }
}

function enqueueTtfb(value: number): void {
  if (!TELEMETRY_ENABLED) return;
  enqueue({
    type: 'vital',
    name: 'ttfb',
    value: Number(Math.max(0, value).toFixed(2)),
    rating: ratingFor(value, 800, 1800),
  });
}

function approximateInp(): void {
  if (interactionDurations.length === 0) return;
  const sorted = [...interactionDurations].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.98) - 1);
  recordVital('inp', sorted[index]);
}

export function initObservability(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  window.addEventListener('error', (event) => {
    reportError(event.error ?? event.message, { source: 'window.onerror' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    reportError(event.reason, { source: 'unhandledrejection' });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      approximateInp();
      flush();
    }
  });

  window.addEventListener('pagehide', () => {
    approximateInp();
    flush();
  });

  observeVitals();
}
