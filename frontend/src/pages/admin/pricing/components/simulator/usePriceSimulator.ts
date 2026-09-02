import { useCallback, useMemo, useState } from 'react';
import { pricingApi } from '../../../../../lib/api';
import { getApiError } from '../../../../../lib/apiErrors';
import {
  INITIAL_SIMULATOR_FORM,
  type SimulationResult,
  type SimulatorForm,
} from '../../../../../types/pricing';

/** Payload accepted by POST /api/pricing/simulate (kept in sync with pricingApi). */
type SimulatePayload = Parameters<typeof pricingApi.simulate>[0];

/** Maps the UI form onto the payload the simulation endpoint expects. */
function buildSimulatePayload(form: SimulatorForm): SimulatePayload {
  const proposed_rule: SimulatePayload['proposed_rule'] = {
    price_list_id: Number(form.price_list_id),
    min_quantity: form.min_quantity,
  };

  // Scope
  if (form.scope === 'product') proposed_rule.varekode = form.varekode || null;
  else if (form.scope === 'category') proposed_rule.varegruppe = form.varegruppe || null;

  // Target
  if (form.target === 'customer') proposed_rule.kundenr = form.kundenr || null;
  else if (form.target === 'group') proposed_rule.customer_group_id = Number(form.customer_group_id) || null;

  // Discount
  if (form.discount_type === 'percent') {
    proposed_rule.discount_percent = Number(form.discount_percent);
    proposed_rule.fixed_price = null;
  } else {
    proposed_rule.fixed_price = Number(form.fixed_price);
    proposed_rule.discount_percent = null;
  }

  const payload: SimulatePayload = { proposed_rule, sample_size: form.sample_size };
  if (form.start_date) payload.start_date = form.start_date;
  if (form.end_date) payload.end_date = form.end_date;
  return payload;
}

/**
 * State and actions for the "what-if" price simulator: form editing,
 * validation, and running the simulation against historical orders.
 */
export function usePriceSimulator() {
  const [form, setForm] = useState<SimulatorForm>(INITIAL_SIMULATOR_FORM);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    <K extends keyof SimulatorForm>(key: K, value: SimulatorForm[K]) =>
      setForm((prev: SimulatorForm) => ({ ...prev, [key]: value })),
    [],
  );

  const reset = useCallback(() => {
    setForm(INITIAL_SIMULATOR_FORM);
    setResult(null);
    setError(null);
  }, []);

  /** True when the form holds everything the simulation needs. */
  const canRun = useMemo(() => {
    if (!form.price_list_id) return false;
    if (form.discount_type === 'percent' && !form.discount_percent) return false;
    if (form.discount_type === 'fixed' && !form.fixed_price) return false;
    if (form.scope === 'product' && !form.varekode) return false;
    if (form.scope === 'category' && !form.varegruppe) return false;
    if (form.target === 'customer' && !form.kundenr) return false;
    if (form.target === 'group' && !form.customer_group_id) return false;
    return true;
  }, [form]);

  const run = useCallback(async () => {
    setError(null);
    setIsRunning(true);

    try {
      const response = await pricingApi.simulate(buildSimulatePayload(form));
      setResult(response.data);
    } catch (err) {
      setError(getApiError(err, 'Simuleringen feilet'));
    } finally {
      setIsRunning(false);
    }
  }, [form]);

  return { form, update, reset, run, canRun, result, isRunning, error };
}
