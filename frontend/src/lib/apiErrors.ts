import toast from 'react-hot-toast';

export type ApiErrorPayload = {
  message: string;
  status?: number;
  url?: string;
};

// Known backend (Zod/pydantic) fragments -> Norwegian UI text.
// Matching is case-insensitive substring search so "Validation failed: ..."
// wrappers still translate. Returns null when no known fragment matches.
const translateBackendMessage = (raw: string): string | null => {
  const msg = raw.toLowerCase();

  if (
    msg.includes('exactly one of discount_percent or fixed_price') ||
    msg.includes('proposed_rule requires exactly one')
  ) {
    return 'Velg enten prosent eller fast pris (ikke begge/ingen)';
  }
  if (msg.includes('valid_from must be <= valid_to')) {
    return 'Fra-dato må være før til-dato';
  }
  if (msg.includes('start_date must be <= end_date')) {
    return 'Startdato må være før sluttdato';
  }
  if (msg.includes('expected number, received string') && msg.includes('customer_group_id')) {
    return 'Velg kundegruppe fra listen';
  }
  if (msg.includes('min_quantity') && msg.includes('greater than or equal to 0')) {
    return 'Min. antall kan ikke være negativ';
  }
  if (msg.includes('discount_percent') && msg.includes('less than or equal to 100')) {
    return 'Rabatt kan maks være 100 %';
  }
  return null;
};

export const getApiError = (err: unknown, fallback: string): string => {
  let raw: string | null = null;
  if (
    err &&
    typeof err === 'object' &&
    'response' in err &&
    err.response &&
    typeof err.response === 'object' &&
    'data' in err.response &&
    err.response.data &&
    typeof err.response.data === 'object' &&
    'error' in err.response.data
  ) {
    raw = String((err.response.data as { error: unknown }).error);
  } else if (err instanceof Error && err.message) {
    raw = err.message;
  }
  if (raw) {
    const translated = translateBackendMessage(raw);
    if (translated && translated !== raw) {
      // Keep raw for debugging, but show Norwegian first.
      return `${translated} (${raw})`;
    }
    return raw;
  }
  return fallback;
};

export const notifyApiError = (payload: ApiErrorPayload) => {
  // A stable id per message collapses parallel failures (e.g. a dashboard
  // firing many queries while the API is down) into one visible toast
  // instead of stacking identical copies.
  toast.error(payload.message, { id: `api-error:${payload.message}` });
};
