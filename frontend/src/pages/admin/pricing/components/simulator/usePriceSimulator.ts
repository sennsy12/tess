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

/** Trims and parses a string field; null when empty or not finite (never NaN). */
function parseFiniteNumber(raw: string): number | null {
  const trimmed = (raw ?? '').trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

/** Maps the UI form onto the payload the simulation endpoint expects. */
function buildSimulatePayload(form: SimulatorForm): SimulatePayload {
  const priceListId = parseFiniteNumber(form.price_list_id ?? '');
  const proposed_rule: SimulatePayload['proposed_rule'] = {
    price_list_id: priceListId ?? 0,
    min_quantity: Number.isFinite(form.min_quantity) ? form.min_quantity : 0,
  };

  // Scope (trimmed; empty -> null)
  const varekode = (form.varekode ?? '').trim();
  const varegruppe = (form.varegruppe ?? '').trim();
  if (form.scope === 'product') proposed_rule.varekode = varekode || null;
  else if (form.scope === 'category') proposed_rule.varegruppe = varegruppe || null;

  // Target (trimmed; empty -> null)
  const kundenr = (form.kundenr ?? '').trim();
  const groupRaw = (form.customer_group_id ?? '').trim();
  if (form.target === 'customer') proposed_rule.kundenr = kundenr || null;
  else if (form.target === 'group') {
    if (groupRaw === '') {
      proposed_rule.customer_group_id = null;
    } else {
      const g = Number(groupRaw);
      proposed_rule.customer_group_id = Number.isFinite(g) ? g : null;
    }
  }

  // Discount (XOR by construction; empty/non-finite -> null so canRun blocks, never NaN)
  if (form.discount_type === 'percent') {
    proposed_rule.discount_percent = parseFiniteNumber(form.discount_percent ?? '');
    proposed_rule.fixed_price = null;
  } else {
    proposed_rule.fixed_price = parseFiniteNumber(form.fixed_price ?? '');
    proposed_rule.discount_percent = null;
  }

  const payload: SimulatePayload = { proposed_rule };
  if (Number.isFinite(form.sample_size)) payload.sample_size = form.sample_size;
  const start = (form.start_date ?? '').trim();
  const end = (form.end_date ?? '').trim();
  if (start) payload.start_date = start;
  if (end) payload.end_date = end;
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
    if (!(form.price_list_id ?? '').trim()) return false;

    // Discount: finite + range. Explicit empty-string check so '0' stays valid.
    if (form.discount_type === 'percent') {
      const raw = (form.discount_percent ?? '').trim();
      if (raw === '') return false;
      const n = Number(raw);
      if (!Number.isFinite(n)) return false;
      if (n < 0 || n > 100) return false;
    } else {
      const raw = (form.fixed_price ?? '').trim();
      if (raw === '') return false;
      const n = Number(raw);
      if (!Number.isFinite(n)) return false;
      if (n < 0) return false;
    }

    if (!Number.isInteger(form.min_quantity) || form.min_quantity < 0) return false;

    if (form.scope === 'product') {
      const v = (form.varekode ?? '').trim();
      if (!v || v.length > 50) return false;
    }
    if (form.scope === 'category') {
      const v = (form.varegruppe ?? '').trim();
      if (!v || v.length > 50) return false;
    }
    if (form.target === 'customer') {
      const v = (form.kundenr ?? '').trim();
      if (!v || v.length > 50) return false;
    }
    const groupRaw = (form.customer_group_id ?? '').trim();
    if (form.target === 'group') {
      if (!groupRaw) return false;
      const g = Number(groupRaw);
      if (!Number.isInteger(g) || g <= 0) return false;
    } else if (groupRaw) {
      const g = Number(groupRaw);
      if (!Number.isInteger(g) || g <= 0) return false;
    }

    const start = (form.start_date ?? '').trim();
    const end = (form.end_date ?? '').trim();
    if (start && end && start > end) return false;

    if (!Number.isInteger(form.sample_size) || form.sample_size < 1 || form.sample_size > 5000)
      return false;

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
