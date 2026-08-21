import toast from 'react-hot-toast';

export type ApiErrorPayload = {
  message: string;
  status?: number;
  url?: string;
};

export const getApiError = (err: unknown, fallback: string): string => {
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
    return String((err.response.data as { error: unknown }).error);
  }
  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
};

export const notifyApiError = (payload: ApiErrorPayload) => {
  // A stable id per message collapses parallel failures (e.g. a dashboard
  // firing many queries while the API is down) into one visible toast
  // instead of stacking identical copies.
  toast.error(payload.message, { id: `api-error:${payload.message}` });
};
