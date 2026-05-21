import type { SortDirection } from './queryKeys';
import type { OrderFilters, ProductFilters, CustomerFilters } from './queryKeys';

function setIfPresent(params: URLSearchParams, key: string, value: string | number | null | undefined) {
  if (value === undefined || value === null || value === '') {
    params.delete(key);
  } else {
    params.set(key, String(value));
  }
}

// ── Orders ──────────────────────────────────────────────────

export function orderFiltersFromSearchParams(params: URLSearchParams): Partial<{
  page: number;
  filters: OrderFilters;
  sortKey: string;
  sortDirection: SortDirection;
}> {
  const result: Partial<{
    page: number;
    filters: OrderFilters;
    sortKey: string;
    sortDirection: SortDirection;
  }> = {};

  const page = params.get('page');
  if (page) {
    const n = Number(page);
    if (Number.isFinite(n) && n >= 1) result.page = n;
  }

  const ordrenr = params.get('ordrenr');
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');
  const search = params.get('search') ?? params.get('kundenr');
  const workflowStatus = params.get('workflowStatus');
  if (ordrenr || startDate || endDate || search || workflowStatus) {
    result.filters = {
      ordrenr: ordrenr ?? '',
      startDate: startDate ?? '',
      endDate: endDate ?? '',
      search: search ?? '',
      workflowStatus: workflowStatus ?? '',
    };
  }

  const sortBy = params.get('sortBy');
  const sortDir = params.get('sortDir');
  if (sortBy && (sortDir === 'asc' || sortDir === 'desc')) {
    result.sortKey = sortBy;
    result.sortDirection = sortDir;
  }

  return result;
}

export function orderFiltersToSearchParams(
  page: number,
  filters: OrderFilters,
  sortKey: string | null,
  sortDirection: SortDirection,
): URLSearchParams {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  setIfPresent(params, 'ordrenr', filters.ordrenr);
  setIfPresent(params, 'startDate', filters.startDate);
  setIfPresent(params, 'endDate', filters.endDate);
  setIfPresent(params, 'search', filters.search);
  setIfPresent(params, 'workflowStatus', filters.workflowStatus);
  if (sortKey && sortDirection) {
    params.set('sortBy', sortKey);
    params.set('sortDir', sortDirection);
  }
  return params;
}

// ── Products ────────────────────────────────────────────────

export function productFiltersFromSearchParams(params: URLSearchParams): Partial<{
  page: number;
  filters: ProductFilters;
  sortKey: string;
  sortDirection: SortDirection;
}> {
  const result: Partial<{
    page: number;
    filters: ProductFilters;
    sortKey: string;
    sortDirection: SortDirection;
  }> = {};

  const page = params.get('page');
  if (page) {
    const n = Number(page);
    if (Number.isFinite(n) && n >= 1) result.page = n;
  }

  const search = params.get('search');
  const group = params.get('group');
  if (search || group) {
    result.filters = { search: search ?? '', groupFilter: group ?? '' };
  }

  const sortBy = params.get('sortBy');
  const sortDir = params.get('sortDir');
  if (sortBy && (sortDir === 'asc' || sortDir === 'desc')) {
    result.sortKey = sortBy;
    result.sortDirection = sortDir;
  }

  return result;
}

export function productFiltersToSearchParams(
  page: number,
  filters: ProductFilters,
  sortKey: string | null,
  sortDirection: SortDirection,
): URLSearchParams {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  setIfPresent(params, 'search', filters.search.trim());
  setIfPresent(params, 'group', filters.groupFilter);
  if (sortKey && sortDirection) {
    params.set('sortBy', sortKey);
    params.set('sortDir', sortDirection);
  }
  return params;
}

// ── Customers ───────────────────────────────────────────────

export function customerFiltersFromSearchParams(params: URLSearchParams): Partial<{
  page: number;
  filters: CustomerFilters;
  sortKey: string;
  sortDirection: SortDirection;
}> {
  const result: Partial<{
    page: number;
    filters: CustomerFilters;
    sortKey: string;
    sortDirection: SortDirection;
  }> = {};

  const page = params.get('page');
  if (page) {
    const n = Number(page);
    if (Number.isFinite(n) && n >= 1) result.page = n;
  }

  const search = params.get('search');
  const group = params.get('group');
  if (search || group) {
    result.filters = { search: search ?? '', groupFilter: group ?? '' };
  }

  const sortBy = params.get('sortBy');
  const sortDir = params.get('sortDir');
  if (sortBy && (sortDir === 'asc' || sortDir === 'desc')) {
    result.sortKey = sortBy;
    result.sortDirection = sortDir;
  }

  return result;
}

export function customerFiltersToSearchParams(
  page: number,
  filters: CustomerFilters,
  sortKey: string | null,
  sortDirection: SortDirection,
): URLSearchParams {
  const params = new URLSearchParams();
  if (page > 1) params.set('page', String(page));
  setIfPresent(params, 'search', filters.search.trim());
  setIfPresent(params, 'group', filters.groupFilter);
  if (sortKey && sortDirection) {
    params.set('sortBy', sortKey);
    params.set('sortDir', sortDirection);
  }
  return params;
}
