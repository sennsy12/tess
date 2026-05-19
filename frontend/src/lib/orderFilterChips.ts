import type { FilterChip } from '../components/ActiveFilterChips';

export type OrderFilters = {
  ordrenr: string;
  startDate: string;
  endDate: string;
  search: string;
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
  return filters;
}
