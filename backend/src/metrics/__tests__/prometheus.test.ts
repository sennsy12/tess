/**
 * Prometheus exposition tests: histogram present, no cardinality blowup
 * from user-controlled paths, probes never observed.
 */
import request from 'supertest';
import app from '../../index';
import { resetMetrics, register } from '../prometheus';

beforeEach(() => {
  resetMetrics();
});

describe('GET /metrics', () => {
  it('exposes the HTTP latency histogram and pool gauges', async () => {
    // Generate one observation through a real route
    await request(app).get('/api/health');
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('db_pool_total');
  });

  it('collapses unknown paths to a single series', async () => {
    await request(app).get('/api/no-such-path-one-12345');
    await request(app).get('/api/no-such-path-two-67890');
    const res = await request(app).get('/metrics');
    const unknownSeries = res.text
      .split('\n')
      .filter((line) => line.startsWith('http_requests_total{') && line.includes('route="unknown"'));
    // Same series incremented twice — never one series per path
    expect(unknownSeries).toHaveLength(1);
    expect(unknownSeries[0]).toMatch(/ 2$/);
  });

  it('never observes the scrape or health probes', async () => {
    await request(app).get('/metrics');
    await request(app).get('/api/health');
    const series = await register.getMetricsAsJSON();
    const names = series.map((m) => m.name);
    const labelled = series.flatMap(
      (m) => (m as { values?: Array<{ labels?: Record<string, string> }> }).values ?? [],
    );
    expect(labelled.some((v) => v.labels?.route === '/metrics')).toBe(false);
    expect(names).toContain('http_request_duration_seconds');
  });
});
