export type ApiErrorPayload = {
  message: string;
  status?: number;
  url?: string;
};

const EVENT_NAME = 'api-error';

export const notifyApiError = (payload: ApiErrorPayload) => {
  window.dispatchEvent(new CustomEvent<ApiErrorPayload>(EVENT_NAME, { detail: payload }));
};

export const subscribeApiErrors = (handler: (payload: ApiErrorPayload) => void) => {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<ApiErrorPayload>;
    handler(customEvent.detail);
  };
  window.addEventListener(EVENT_NAME, listener);
  return () => window.removeEventListener(EVENT_NAME, listener);
};
