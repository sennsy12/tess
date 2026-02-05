import toast from 'react-hot-toast';

export type ApiErrorPayload = {
  message: string;
  status?: number;
  url?: string;
};

export const notifyApiError = (payload: ApiErrorPayload) => {
  toast.error(payload.message);
};
