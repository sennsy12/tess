import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useOrderSubmission } from '../useOrderSubmission';

const { createMock, cartClear, navigateMock, toastSuccess, toastError } = vi.hoisted(() => ({
  createMock: vi.fn(),
  cartClear: vi.fn(),
  navigateMock: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock('../../context/useCart', () => ({
  useCart: () => ({
    items: [{ varekode: 'V001', antall: 2, unit_price: 100, varenavn: 'Testvare' }],
    clear: cartClear,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('react-hot-toast', () => ({
  default: { success: toastSuccess, error: toastError },
}));

vi.mock('../../lib/api', () => ({
  ordersApi: { create: createMock },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function renderSubmission() {
  const closeConfirm = vi.fn();
  const hook = renderHook(() => useOrderSubmission(closeConfirm), {
    wrapper: createWrapper(),
  });
  return { ...hook, closeConfirm };
}

describe('useOrderSubmission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submits the cart with a 32-char idempotency key and trims references', async () => {
    createMock.mockResolvedValue({ data: { ordrenr: 123 } });
    const { result, closeConfirm } = renderSubmission();

    act(() => {
      result.current.onKundeordrerefChange('  REF-1  ');
      result.current.onKunderefChange('   ');
    });
    act(() => {
      result.current.submit();
    });

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/kunde/orders/123'));

    expect(createMock).toHaveBeenCalledTimes(1);
    const payload = createMock.mock.calls[0][0];
    expect(payload.items).toEqual([{ varekode: 'V001', antall: 2 }]);
    expect(payload.kundeordreref).toBe('REF-1');
    expect(payload.kunderef).toBeUndefined();
    expect(payload.idempotencyKey).toHaveLength(32);

    expect(cartClear).toHaveBeenCalled();
    expect(closeConfirm).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Ordre #123 sendt til godkjenning');
  });

  it('surfaces the API error and keeps the cart intact on failure', async () => {
    createMock.mockRejectedValue({ response: { data: { error: 'Ikke godkjent' } } });
    const { result, closeConfirm } = renderSubmission();

    act(() => {
      result.current.submit();
    });

    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Ikke godkjent'));

    expect(cartClear).not.toHaveBeenCalled();
    expect(closeConfirm).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
