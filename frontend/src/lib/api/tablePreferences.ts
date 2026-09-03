import api from './client';
import type { TablePreferences } from '../../types/tablePreferences';

export const tablePreferencesApi = {
  get: (tableKey: string) =>
    api.get<TablePreferences>(`/table-preferences/${encodeURIComponent(tableKey)}`),
  save: (tableKey: string, payload: { visibleColumns?: string[]; columnLabels?: Record<string, string> }) =>
    api.put<TablePreferences>(`/table-preferences/${encodeURIComponent(tableKey)}`, payload),
};
