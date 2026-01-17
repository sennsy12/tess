import { Request, Response, NextFunction } from 'express';

interface ApiMetric {
  path: string;
  method: string;
  avgMs: number;
  minMs: number;
  maxMs: number;
  count: number;
  slowCount: number; // requests > 1000ms
  lastCalled: Date;
  recentTimes: number[]; // last 10 response times
}

// Store metrics in memory
const metricsStore: Map<string, ApiMetric> = new Map();
const SLOW_THRESHOLD_MS = 1000; // 1 second
const MAX_RECENT_TIMES = 10;

/**
 * Middleware to track API response times
 */
export function apiMetricsMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  
  // Hook into response finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const key = `${req.method}:${req.route?.path || req.path}`;
    
    // Get or create metric
    let metric = metricsStore.get(key);
    if (!metric) {
      metric = {
        path: req.route?.path || req.path,
        method: req.method,
        avgMs: duration,
        minMs: duration,
        maxMs: duration,
        count: 0,
        slowCount: 0,
        lastCalled: new Date(),
        recentTimes: []
      };
    }

    // Update metrics
    metric.count++;
    metric.lastCalled = new Date();
    metric.minMs = Math.min(metric.minMs, duration);
    metric.maxMs = Math.max(metric.maxMs, duration);
    
    // Update rolling average
    metric.avgMs = Math.round(
      (metric.avgMs * (metric.count - 1) + duration) / metric.count
    );

    // Track slow requests
    if (duration > SLOW_THRESHOLD_MS) {
      metric.slowCount++;
    }

    // Keep last N response times for sparkline
    metric.recentTimes.push(duration);
    if (metric.recentTimes.length > MAX_RECENT_TIMES) {
      metric.recentTimes.shift();
    }

    metricsStore.set(key, metric);
  });

  next();
}

/**
 * Get all collected metrics
 */
export function getApiMetrics(): ApiMetric[] {
  const metrics = Array.from(metricsStore.values());
  
  // Sort by average time descending (slowest first)
  return metrics.sort((a, b) => b.avgMs - a.avgMs);
}

/**
 * Get summary stats
 */
export function getApiMetricsSummary() {
  const metrics = getApiMetrics();
  
  const totalRequests = metrics.reduce((sum, m) => sum + m.count, 0);
  const totalSlowRequests = metrics.reduce((sum, m) => sum + m.slowCount, 0);
  const slowestEndpoint = metrics[0] || null;
  const mostCalled = [...metrics].sort((a, b) => b.count - a.count)[0] || null;

  return {
    totalEndpoints: metrics.length,
    totalRequests,
    totalSlowRequests,
    slowestEndpoint: slowestEndpoint ? {
      path: slowestEndpoint.path,
      method: slowestEndpoint.method,
      avgMs: slowestEndpoint.avgMs
    } : null,
    mostCalled: mostCalled ? {
      path: mostCalled.path,
      method: mostCalled.method,
      count: mostCalled.count
    } : null,
    status: totalSlowRequests > 10 ? 'warning' : 'ok'
  };
}

/**
 * Clear metrics (for testing or reset)
 */
export function clearApiMetrics() {
  metricsStore.clear();
}
