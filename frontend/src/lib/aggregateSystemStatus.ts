/**
 * Samlet systemstatus for /admin/status.
 *
 * Ren funksjon (ingen React, ingen datoer): queries -> rådata ->
 * `aggregateSystemStatus()` -> `SystemStatusStrip`. Testes isolert med vitest.
 *
 * Regel: worst-of (error > warning > ok). Stripen er tidlig varsling:
 *  - >0 trege API-kall gir warning her (proporsjonal tekst, ikke dramatisk),
 *    mens detaljkort/backend beholder den konservative >10-grensen.
 *  - ETL-avvisninger vurderes kun på siste kjøring (total er kumulativ
 *    og ville advart for alltid etter én feil).
 */

export type SystemLevel = 'ok' | 'warning' | 'error' | 'loading';

export interface AggregateSystemStatusInput {
  systemStatus?: { status?: string; database?: { connected?: boolean } } | null;
  healthStatus?: { status?: string } | null;
  importStatus?: { status?: string } | null;
  extractionStatus?: { status?: string } | null;
  apiMetrics?: {
    summary?: { status?: string; totalRequests?: number; totalSlowRequests?: number } | null;
  } | null;
  etlMetrics?: {
    summary?: { totalRuns?: number; totalRejectedRows?: number } | null;
    recentRuns?: Array<{ rejectedRows?: number }> | null;
  } | null;
  recentActivity?: { status?: string; message?: string } | null;
  errors: {
    system: boolean;
    health: boolean;
    import: boolean;
    extraction: boolean;
    apiMetrics: boolean;
    etlMetrics: boolean;
    recentActivity: boolean;
  };
  /** True når minst én av status-queries har data. */
  hasAnyData: boolean;
  /** True når minst én av status-queries laster. */
  isAnyLoading: boolean;
}

export interface AggregatedSystemStatus {
  level: SystemLevel;
  /** Proporsjonale, menneskelesbare begrunnelser (maks et par vises i UI). */
  reasons: string[];
  counts: { errors: number; warnings: number };
}

const isHealthyStatus = (status?: string) => status === 'ok' || status === 'healthy';

export function aggregateSystemStatus(input: AggregateSystemStatusInput): AggregatedSystemStatus {
  const {
    systemStatus,
    healthStatus,
    importStatus,
    extractionStatus,
    apiMetrics,
    etlMetrics,
    recentActivity,
    errors,
    hasAnyData,
    isAnyLoading,
  } = input;

  // Initial lasting: ingen data ennå, men noe laster. Ved partiell refetch
  // (5 har data, 1 laster) skal vi IKKE tilbake til loading – da vises
  // gammel status + QueryRefetchBar (null flimring).
  if (!hasAnyData && isAnyLoading) {
    return { level: 'loading', reasons: [], counts: { errors: 0, warnings: 0 } };
  }

  const errorReasons: string[] = [];
  const warningReasons: string[] = [];

  // — Feil (harde): spørringsfeil eller eksplisitt usunn status ————
  if (errors.system) errorReasons.push('Kunne ikke laste systemstatus');
  else if (systemStatus && !isHealthyStatus(systemStatus.status))
    errorReasons.push(`System melder ${systemStatus.status}`);
  if (systemStatus?.database && systemStatus.database.connected === false)
    errorReasons.push('Databasen er frakoblet');

  if (errors.health) errorReasons.push('Kunne ikke laste backend-helse');
  else if (healthStatus && !isHealthyStatus(healthStatus.status))
    errorReasons.push(`Backend melder ${healthStatus.status}`);

  if (errors.import) errorReasons.push('Kunne ikke laste importstatus');
  if (errors.extraction) errorReasons.push('Kunne ikke laste extraction-status');
  if (errors.apiMetrics) errorReasons.push('Kunne ikke laste API-ytelse');
  if (errors.etlMetrics) errorReasons.push('Kunne ikke laste ETL-historikk');
  if (errors.recentActivity) errorReasons.push('Kunne ikke laste dataferskhet');

  // — Varsler (myke): avvik, men ikke feil ————
  if (!errors.import && importStatus && !isHealthyStatus(importStatus.status))
    warningReasons.push(`Import melder ${importStatus.status}`);
  if (!errors.extraction && extractionStatus && !isHealthyStatus(extractionStatus.status))
    warningReasons.push(`Extraction melder ${extractionStatus.status}`);

  const slow = apiMetrics?.summary?.totalSlowRequests ?? 0;
  if (!errors.apiMetrics && slow > 0) {
    warningReasons.push(
      slow === 1 ? 'API har registrert 1 tregt kall' : `API har registrert ${slow} trege kall`,
    );
  }

  const lastRunRejected =
    etlMetrics?.recentRuns?.[0]?.rejectedRows ?? etlMetrics?.summary?.totalRejectedRows ?? 0;
  // recentRuns[0] foretrekkes: summary.totalRejectedRows er kumulativ og
  // ville advart for alltid etter én historisk feil.
  if (!errors.etlMetrics && etlMetrics && lastRunRejected > 0) {
    warningReasons.push(
      lastRunRejected === 1
        ? 'ETL avviste 1 rad i siste kjøring'
        : `ETL avviste ${lastRunRejected} rader i siste kjøring`,
    );
  }

  // Dataferskhet: stale er et varsel, ikke feil – data finnes, men kan være gamle.
  if (!errors.recentActivity && recentActivity?.status === 'stale') {
    warningReasons.push(recentActivity.message || 'Data kan være utdatert, vurder en import');
  }

  // In-memory-metrikker nullstilles ved backend-restart. Uten denne ville
  // «0 trege kall» sett trygt ut rett etter deploy – marker heller at
  // metrikkene er tomme.
  const apiTotal = apiMetrics?.summary?.totalRequests;
  const etlRuns = etlMetrics?.summary?.totalRuns;
  if (
    hasAnyData &&
    !isAnyLoading &&
    apiMetrics &&
    etlMetrics &&
    apiTotal === 0 &&
    etlRuns === 0
  ) {
    warningReasons.push('Metrikker er nullstilt (siden siste deploy)');
  }

  if (errorReasons.length > 0) {
    return {
      level: 'error',
      reasons: errorReasons,
      counts: { errors: errorReasons.length, warnings: warningReasons.length },
    };
  }
  if (warningReasons.length > 0) {
    return {
      level: 'warning',
      reasons: warningReasons,
      counts: { errors: 0, warnings: warningReasons.length },
    };
  }
  return { level: 'ok', reasons: [], counts: { errors: 0, warnings: 0 } };
}
