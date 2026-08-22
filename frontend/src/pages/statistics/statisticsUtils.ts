import {
  statisticsApi,
  PaginatedResponse,
  KundeStats,
  VaregruppeStats,
  VareStats,
  LagerStats,
  FirmaStats,
} from '../../lib/api';
import { toDateInputLocal } from '../../lib/formatters';
import { StatType } from '../../types/statistics';

type StatRow = KundeStats | VaregruppeStats | VareStats | LagerStats | FirmaStats;

export const STATISTICS_EXPORT_PAGE_SIZE = 500;
export const STATISTICS_EXPORT_ROW_CAP = 5000;

export function getPreviousRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { startDate: toDateInputLocal(prevStart), endDate: toDateInputLocal(prevEnd) };
}

export async function fetchStatData(statType: StatType, params: Record<string, unknown>) {
  let response;
  switch (statType) {
    case 'kunde':
      response = await statisticsApi.byKunde(params);
      break;
    case 'varegruppe':
      response = await statisticsApi.byVaregruppe(params);
      break;
    case 'vare':
      response = await statisticsApi.byVare(params);
      break;
    case 'lager':
      response = await statisticsApi.byLager(params);
      break;
    case 'firma':
      response = await statisticsApi.byFirma(params);
      break;
  }
  return response?.data as PaginatedResponse<StatRow>;
}

export function getNameKey(statType: StatType) {
  switch (statType) {
    case 'kunde':
      return 'kundenavn';
    case 'varegruppe':
      return 'varegruppe';
    case 'vare':
      return 'varenavn';
    case 'lager':
      return 'lagernavn';
    case 'firma':
      return 'firmanavn';
  }
}

/** Fetches every page of a statistics grouping (capped) so exports cover the full period, not just the visible page. */
export async function fetchAllStatRows(
  statType: StatType,
  params: Record<string, unknown>,
): Promise<StatRow[]> {
  const firstPage = await fetchStatData(statType, {
    ...params,
    page: 1,
    limit: STATISTICS_EXPORT_PAGE_SIZE,
  });
  const rows: StatRow[] = [...(firstPage.data ?? [])];

  const maxPages = Math.ceil(STATISTICS_EXPORT_ROW_CAP / STATISTICS_EXPORT_PAGE_SIZE);
  const totalPages = Math.min(firstPage.pagination?.totalPages ?? 1, maxPages);

  for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
    const nextPage = await fetchStatData(statType, {
      ...params,
      page: pageNumber,
      limit: STATISTICS_EXPORT_PAGE_SIZE,
    });
    rows.push(...(nextPage.data ?? []));
  }

  return rows.slice(0, STATISTICS_EXPORT_ROW_CAP);
}

export function buildStatsExportRows(
  rows: StatRow[],
  statType: StatType,
): Array<Record<string, unknown>> {
  const nameKey = getNameKey(statType);
  const nameHeader = getTitle(statType).replace('Statistikk per ', '');
  return rows.map((row) => ({
    [nameHeader]: row[nameKey as keyof StatRow] ?? '',
    'Antall ordrer': row.order_count ?? 0,
    'Total sum': row.total_sum ?? 0,
  }));
}

export function getTitle(statType: StatType) {
  switch (statType) {
    case 'kunde':
      return 'Statistikk per Kunde';
    case 'varegruppe':
      return 'Statistikk per Varegruppe';
    case 'vare':
      return 'Statistikk per Vare';
    case 'lager':
      return 'Statistikk per Lager';
    case 'firma':
      return 'Statistikk per Firma';
  }
}

export function getStatisticsHome(savedViewsScope: string) {
  if (savedViewsScope.startsWith('kunde')) {
    return { label: 'Hjem', to: '/kunde' };
  }
  if (savedViewsScope.startsWith('analyse')) {
    return { label: 'Dashboard', to: '/analyse' };
  }
  return { label: 'Dashboard', to: '/admin' };
}

export function getSavedViewsDescription(savedViewsScope: string, enableSharedViews: boolean) {
  if (enableSharedViews) {
    return 'Lagre filtre og sammenligninger, og del visninger med andre administratorer.';
  }
  if (savedViewsScope.startsWith('analyse')) {
    return 'Lagre statistikkoppsett og bruk dem igjen med ett klikk.';
  }
  return 'Lagre filtre og sammenligninger for rask tilgang senere.';
}
