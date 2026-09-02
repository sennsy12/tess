import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePriceSimulator } from '../usePriceSimulator';
import { INITIAL_SIMULATOR_FORM, type SimulationResult } from '../../../../../../types/pricing';

const { simulateMock } = vi.hoisted(() => ({
  simulateMock: vi.fn(),
}));

vi.mock('../../../../../../lib/api', () => ({
  pricingApi: { simulate: simulateMock },
}));

const SIMULATION_RESULT = {
  current: { total_revenue: 1000, total_discount: 100, affected_lines: 10 },
  simulated: { total_revenue: 1200, total_discount: 120, affected_lines: 12 },
  revenue_difference: 200,
  revenue_difference_pct: 20,
  orders_analysed: 5,
  top_customers: [],
  top_products: [],
  trend: [],
  computation_time_ms: 12,
} as unknown as SimulationResult;

/** Minimal shape of the renderHook `result` we interact with. */
interface SimulatorHookResult {
  current: ReturnType<typeof usePriceSimulator>;
}

/** Makes the form pass validation for the default (all/all/percent) scope. */
async function fillMinimumValidForm(hook: SimulatorHookResult) {
  act(() => {
    hook.current.update('price_list_id', '1');
    hook.current.update('discount_percent', '15');
  });
}

describe('usePriceSimulator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with the initial form and a disabled run button', () => {
    const { result } = renderHook(() => usePriceSimulator());

    expect(result.current.form).toEqual(INITIAL_SIMULATOR_FORM);
    expect(result.current.canRun).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('enables run when the required fields are filled', async () => {
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    expect(result.current.canRun).toBe(true);
  });

  it('requires a product code for product scope', async () => {
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    act(() => {
      result.current.update('scope', 'product');
    });
    expect(result.current.canRun).toBe(false);

    act(() => {
      result.current.update('varekode', 'V001');
    });
    expect(result.current.canRun).toBe(true);
  });

  it('requires a fixed price for the fixed discount type', async () => {
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    act(() => {
      result.current.update('discount_type', 'fixed');
    });
    expect(result.current.canRun).toBe(false);

    act(() => {
      result.current.update('fixed_price', '249');
    });
    expect(result.current.canRun).toBe(true);
  });

  it('requires a customer number for customer targeting', async () => {
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    act(() => {
      result.current.update('target', 'customer');
    });
    expect(result.current.canRun).toBe(false);

    act(() => {
      result.current.update('kundenr', 'K001');
    });
    expect(result.current.canRun).toBe(true);
  });

  it('runs a simulation and stores the result', async () => {
    simulateMock.mockResolvedValue({ data: SIMULATION_RESULT });
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    await act(async () => {
      await result.current.run();
    });

    expect(simulateMock).toHaveBeenCalledTimes(1);
    expect(simulateMock.mock.calls[0][0]).toMatchObject({
      proposed_rule: {
        price_list_id: 1,
        min_quantity: 0,
        discount_percent: 15,
        fixed_price: null,
      },
      sample_size: 1000,
    });
    expect(result.current.result).toEqual(SIMULATION_RESULT);
    expect(result.current.error).toBeNull();
  });

  it('maps scope and target onto the proposed rule', async () => {
    simulateMock.mockResolvedValue({ data: SIMULATION_RESULT });
    const { result } = renderHook(() => usePriceSimulator());

    act(() => {
      result.current.update('price_list_id', '2');
      result.current.update('scope', 'category');
      result.current.update('varegruppe', 'Jern');
      result.current.update('target', 'group');
      result.current.update('customer_group_id', '7');
      result.current.update('min_quantity', 5);
      result.current.update('discount_type', 'fixed');
      result.current.update('fixed_price', '99.50');
      result.current.update('start_date', '2025-01-01');
    });

    await act(async () => {
      await result.current.run();
    });

    expect(simulateMock.mock.calls[0][0]).toMatchObject({
      proposed_rule: {
        price_list_id: 2,
        varegruppe: 'Jern',
        customer_group_id: 7,
        min_quantity: 5,
        fixed_price: 99.5,
        discount_percent: null,
      },
      start_date: '2025-01-01',
    });
    expect(simulateMock.mock.calls[0][0].end_date).toBeUndefined();
  });

  it('surfaces the API error message when the simulation fails', async () => {
    simulateMock.mockRejectedValue({ response: { data: { error: 'Ugyldig periode' } } });
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    await act(async () => {
      await result.current.run();
    });

    expect(result.current.error).toBe('Ugyldig periode');
    expect(result.current.result).toBeNull();
  });

  it('reset restores the initial form and clears the result', async () => {
    simulateMock.mockResolvedValue({ data: SIMULATION_RESULT });
    const { result } = renderHook(() => usePriceSimulator());
    await fillMinimumValidForm(result);

    await act(async () => {
      await result.current.run();
    });
    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.form).toEqual(INITIAL_SIMULATOR_FORM);
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
