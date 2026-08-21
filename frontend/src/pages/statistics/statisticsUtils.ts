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
