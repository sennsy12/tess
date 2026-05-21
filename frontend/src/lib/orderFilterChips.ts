import type { FilterChip } from '../components/ActiveFilterChips';
import { ORDER_WORKFLOW_LABELS } from '../types/notification';

export type OrderFilters = {
  ordrenr: string;
  startDate: string;
  endDate: string;
  search: string;
  workflowStatus: string;
};

export function buildOrderFilterChips(filters: OrderFilters): FilterChip[] {
  const chips: FilterChip[] = [];
  if (filters.ordrenr.trim()) {
    chips.push({ id: 'ordrenr', label: `Ordrenr: ${filters.ordrenr}` });
  }
  if (filters.startDate) {
    chips.push({ id: 'startDate', label: `Fra: ${filters.startDate}` });
  }
  if (filters.endDate) {
    chips.push({ id: 'endDate', label: `Til: ${filters.endDate}` });
  }
  if (filters.search.trim()) {
    chips.push({ id: 'search', label: `Søk: ${filters.search}` });
  }
  if (filters.workflowStatus?.trim()) {
    const label =
      ORDER_WORKFLOW_LABELS[filters.workflowStatus as keyof typeof ORDER_WORKFLOW_LABELS] ??
      filters.workflowStatus;
    chips.push({ id: 'workflowStatus', label: `Status: ${label}` });
  }
  return chips;
}

export function clearOrderFilter(
  filters: OrderFilters,
  id: string,
): OrderFilters {
  if (id === 'ordrenr') return { ...filters, ordrenr: '' };
  if (id === 'startDate') return { ...filters, startDate: '' };
  if (id === 'endDate') return { ...filters, endDate: '' };
  if (id === 'search') return { ...filters, search: '' };
  if (id === 'workflowStatus') return { ...filters, workflowStatus: '' };
  return filters;
}
