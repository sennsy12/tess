import { describe, it, expect } from 'vitest';
import {
  aggregateSystemStatus,
  type AggregateSystemStatusInput,
} from '../aggregateSystemStatus';

const noErrors = {
  system: false,
  health: false,
  import: false,
  extraction: false,
  apiMetrics: false,
  etlMetrics: false,
  recentActivity: false,
};

const base: AggregateSystemStatusInput = {
  systemStatus: { status: 'healthy', database: { connected: true } },
  healthStatus: { status: 'healthy' },
  importStatus: { status: 'ok' },
  extractionStatus: { status: 'ok' },
  apiMetrics: { summary: { status: 'ok', totalRequests: 10, totalSlowRequests: 0 } },
  etlMetrics: { summary: { totalRuns: 2, totalRejectedRows: 0 }, recentRuns: [{ rejectedRows: 0 }] },
  recentActivity: { status: 'fresh', message: 'Data is up to date (1 days old)' },
  errors: { ...noErrors },
  hasAnyData: true,
  isAnyLoading: false,
};

describe('aggregateSystemStatus', () => {
  it('er ok når alt er sunt', () => {
    const res = aggregateSystemStatus(base);
    expect(res.level).toBe('ok');
    expect(res.reasons).toEqual([]);
  });

  it('er loading kun når ingen data finnes og noe laster', () => {
    const res = aggregateSystemStatus({
      ...base,
      systemStatus: null,
      healthStatus: null,
      importStatus: null,
      extractionStatus: null,
      apiMetrics: null,
      etlMetrics: null,
      hasAnyData: false,
      isAnyLoading: true,
    });
    expect(res.level).toBe('loading');
  });

  it('går ikke tilbake til loading ved partiell refetch', () => {
    const res = aggregateSystemStatus({ ...base, isAnyLoading: true });
    expect(res.level).toBe('ok');
  });

  it('varsler proporsjonalt ved 1 tregt kall', () => {
    const res = aggregateSystemStatus({
      ...base,
      apiMetrics: { summary: { status: 'ok', totalRequests: 10, totalSlowRequests: 1 } },
    });
    expect(res.level).toBe('warning');
    expect(res.reasons).toEqual(['API har registrert 1 tregt kall']);
  });

  it('varsler med flertallsform ved flere trege kall', () => {
    const res = aggregateSystemStatus({
      ...base,
      apiMetrics: { summary: { status: 'warning', totalRequests: 50, totalSlowRequests: 12 } },
    });
    expect(res.level).toBe('warning');
    expect(res.reasons[0]).toContain('12 trege kall');
  });

  it('varsler ved avviste rader i siste ETL-kjøring', () => {
    const res = aggregateSystemStatus({
      ...base,
      etlMetrics: { summary: { totalRuns: 3, totalRejectedRows: 5 }, recentRuns: [{ rejectedRows: 5 }] },
    });
    expect(res.level).toBe('warning');
    expect(res.reasons[0]).toContain('avviste 5 rader');
  });

  it('ignorerer historiske avvisninger når siste kjøring er ren', () => {
    const res = aggregateSystemStatus({
      ...base,
      etlMetrics: { summary: { totalRuns: 3, totalRejectedRows: 5 }, recentRuns: [{ rejectedRows: 0 }] },
    });
    expect(res.level).toBe('ok');
  });

  it('gir error ved frakoblet database', () => {
    const res = aggregateSystemStatus({
      ...base,
      systemStatus: { status: 'healthy', database: { connected: false } },
    });
    expect(res.level).toBe('error');
    expect(res.reasons).toContain('Databasen er frakoblet');
  });

  it('gir error ved spørringsfeil og navngir kilden', () => {
    const res = aggregateSystemStatus({
      ...base,
      errors: { ...noErrors, import: true },
    });
    expect(res.level).toBe('error');
    expect(res.reasons).toContain('Kunne ikke laste importstatus');
  });

  it('error slår warning (worst-of)', () => {
    const res = aggregateSystemStatus({
      ...base,
      apiMetrics: { summary: { status: 'ok', totalRequests: 10, totalSlowRequests: 3 } },
      errors: { ...noErrors, health: true },
    });
    expect(res.level).toBe('error');
    expect(res.counts.errors).toBe(1);
    expect(res.counts.warnings).toBe(1);
  });

  it('varsler ved nullstilte metrikker etter deploy', () => {
    const res = aggregateSystemStatus({
      ...base,
      apiMetrics: { summary: { status: 'ok', totalRequests: 0, totalSlowRequests: 0 } },
      etlMetrics: { summary: { totalRuns: 0, totalRejectedRows: 0 }, recentRuns: [] },
    });
    expect(res.level).toBe('warning');
    expect(res.reasons).toContain('Metrikker er nullstilt (siden siste deploy)');
  });

  it('varsler ved stale dataferskhet uten å gå i feil', () => {
    const res = aggregateSystemStatus({
      ...base,
      recentActivity: { status: 'stale', message: 'Data may be outdated, consider running an import' },
    });
    expect(res.level).toBe('warning');
    expect(res.reasons).toContain('Data may be outdated, consider running an import');
  });

  it('gir error når dataferskhet ikke kan lastes', () => {
    const res = aggregateSystemStatus({
      ...base,
      recentActivity: null,
      errors: { ...noErrors, recentActivity: true },
    });
    expect(res.level).toBe('error');
    expect(res.reasons).toContain('Kunne ikke laste dataferskhet');
  });
});
