import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ordersApi } from '../lib/api';
import { kundeKeys } from '../lib/queryKeys';
import { useCart } from '../context/useCart';
import { getApiError } from '../lib/apiErrors';

/** Generates an idempotency key for a submission attempt. */
function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Submits the current cart as a customer order.
 *
 * The server re-prices every line and rejects nothing here — client prices
 * are only a suggestion. Each attempt gets a fresh idempotency key so
 * retries and double clicks can never create duplicate orders.
 *
 * On success the cart is cleared, kunde order queries are invalidated and
 * the user is navigated to the new order's detail page.
 *
 * @param closeConfirm callback that dismisses the confirmation dialog
 *   (invoked together with cart clearing on success).
 */
export function useOrderSubmission(closeConfirm: () => void) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const cart = useCart();

  const [kundeordreref, setKundeordreref] = useState('');
  const [kunderef, setKunderef] = useState('');

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await ordersApi.create({
        items: cart.items.map((i) => ({ varekode: i.varekode, antall: i.antall })),
        kundeordreref: kundeordreref.trim() || undefined,
        kunderef: kunderef.trim() || undefined,
        idempotencyKey: newIdempotencyKey(),
      });
      return res.data;
    },
    onSuccess: (data) => {
      cart.clear();
      closeConfirm();
      void queryClient.invalidateQueries({ queryKey: kundeKeys.ordersRoot() });
      toast.success(`Ordre #${data.ordrenr} sendt til godkjenning`);
      navigate(`/kunde/orders/${data.ordrenr}`);
    },
    onError: (err) => {
      toast.error(getApiError(err, 'Kunne ikke sende bestilling'));
    },
  });

  return {
    kundeordreref,
    onKundeordrerefChange: setKundeordreref,
    kunderef,
    onKunderefChange: setKunderef,
    submit: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
  };
}
