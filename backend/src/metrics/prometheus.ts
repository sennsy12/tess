/**
 * Prometheus metrics: HTTP latency histogram, request counter, and
 * connection-pool gauges.
 *
 * Scraped by Prometheus at `GET /metrics`, which is reachable only inside
 * the compose network (Caddy never proxies it). The admin JSON feed at
 * `GET /api/status/api-metrics` (used by the frontend Status page) is
 * unchanged.
 *
 * Cardinality guard: label values come from `req.route` (Express route
 * patterns like `/api/orders/:ordrenr`), never raw paths — user input
 * such as ordrenr/search strings can never create new series.
 *
 * @module metrics/prometheus
 */
import type { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const httpRequestDurationSeconds = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register],
});

export const dbPoolTotal = new client.Gauge({
  name: 'db_pool_total',
  help: 'Total Postgres pool clients',
  registers: [register],
});

export const dbPoolIdle = new client.Gauge({
  name: 'db_pool_idle',
  help: 'Idle Postgres pool clients',
  registers: [register],
});

export const dbPoolWaiting = new client.Gauge({
  name: 'db_pool_waiting',
  help: 'Requests waiting for a Postgres pool client',
  registers: [register],
});

/** Paths never observed (scrape + probes would swamp real signals). */
const SKIPPED_PATHS = new Set(['/metrics', '/api/health', '/api/health/ready']);

/** Normalized route label: Express pattern or `unknown` (never raw input). */
export function routeLabel(req: Request): string {
  if (SKIPPED_PATHS.has(req.path)) return 'skipped';
  const pattern = (req as Request & { route?: { path?: string } }).route?.path;
  if (typeof pattern === 'string' && pattern.length > 0) return pattern;
  return 'unknown';
}

/**
 * Observe every request. Mount globally (after the JSON 404 so misses
 * count as `unknown`, before/after auth — position only affects labels).
 */
export function prometheusMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = routeLabel(req);
    if (route === 'skipped') return;
    const seconds = Number(process.hrtime.bigint() - start) / 1e9;
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    };
    httpRequestDurationSeconds.observe(labels, seconds);
    httpRequestsTotal.inc(labels);
  });
  next();
}

/** Refresh pool gauges from the live pool (lazy import: no pool at load). */
async function refreshPoolGauges(): Promise<void> {
  try {
    const { getPoolStats } = await import('../db/index.js');
    const stats = getPoolStats();
    dbPoolTotal.set(stats.totalCount);
    dbPoolIdle.set(stats.idleCount);
    dbPoolWaiting.set(stats.waitingCount);
  } catch {
    // Pool stats are best-effort; never fail a scrape.
  }
}

/** Prometheus text exposition. */
export async function renderMetrics(): Promise<string> {
  await refreshPoolGauges();
  return register.metrics();
}

/** Test hook: reset all series. */
export function resetMetrics(): void {
  register.resetMetrics();
}
