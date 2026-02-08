import { useState, useCallback, useMemo } from 'react';
import { pricingApi } from '../../../../lib/api';
import type { PriceList, CustomerGroup, SimulationResult, CustomerImpact, ProductImpact } from '../types';

// ────────────────────────────────────────────────────────────
// Props
// ────────────────────────────────────────────────────────────

interface SimulatorTabProps {
  lists: PriceList[];
  groups: CustomerGroup[];
}

// ────────────────────────────────────────────────────────────
// Form state
// ────────────────────────────────────────────────────────────

interface SimulatorForm {
  price_list_id: string;
  scope: 'all' | 'product' | 'category';
  varekode: string;
  varegruppe: string;
  target: 'all' | 'customer' | 'group';
  kundenr: string;
  customer_group_id: string;
  min_quantity: number;
  discount_type: 'percent' | 'fixed';
  discount_percent: string;
  fixed_price: string;
  start_date: string;
  end_date: string;
  sample_size: number;
}

const INITIAL_FORM: SimulatorForm = {
  price_list_id: '',
  scope: 'all',
  varekode: '',
  varegruppe: '',
  target: 'all',
  kundenr: '',
  customer_group_id: '',
  min_quantity: 0,
  discount_type: 'percent',
  discount_percent: '',
  fixed_price: '',
  start_date: '',
  end_date: '',
  sample_size: 1000,
};

// ────────────────────────────────────────────────────────────
// Formatting helpers
// ────────────────────────────────────────────────────────────

const NOK = (v: number) =>
  new Intl.NumberFormat('nb-NO', { style: 'currency', currency: 'NOK', maximumFractionDigits: 0 }).format(v);

const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const diffColor = (v: number) =>
  v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-dark-400';

// ────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────

/** Big KPI card used in the summary row. */
function KpiCard({ label, value, subtext, highlight }: {
  label: string;
  value: string;
  subtext?: string;
  highlight?: 'positive' | 'negative' | 'neutral';
}) {
  const border =
    highlight === 'positive' ? 'border-green-600/40' :
    highlight === 'negative' ? 'border-red-600/40' :
    'border-dark-700';

  return (
    <div className={`bg-dark-800/50 rounded-xl border ${border} p-5`}>
      <p className="text-xs text-dark-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className={`text-sm mt-1 ${diffColor(parseFloat(subtext))}`}>{subtext}</p>}
    </div>
  );
}

/** A single row in the impact table (customers or products). */
function ImpactRow({ name, current, simulated, difference, differencePct }: {
  name: string;
  current: number;
  simulated: number;
  difference: number;
  differencePct: number;
}) {
  return (
    <tr className="border-t border-dark-800 hover:bg-dark-800/30">
      <td className="py-2.5 px-3 text-sm font-medium text-dark-100">{name}</td>
      <td className="py-2.5 px-3 text-sm text-right font-mono">{NOK(current)}</td>
      <td className="py-2.5 px-3 text-sm text-right font-mono">{NOK(simulated)}</td>
      <td className={`py-2.5 px-3 text-sm text-right font-mono font-semibold ${diffColor(difference)}`}>
        {NOK(difference)}
      </td>
      <td className={`py-2.5 px-3 text-sm text-right font-mono ${diffColor(differencePct)}`}>
        {pct(differencePct)}
      </td>
    </tr>
  );
}

/** Tabular breakdown of affected customers or products. */
function ImpactTable<T extends CustomerImpact | ProductImpact>({
  title,
  data,
  nameKey,
}: {
  title: string;
  data: T[];
  nameKey: (row: T) => string;
}) {
  if (data.length === 0) return null;

  return (
    <div className="card">
      <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wide mb-3">{title}</h4>
      <div className="overflow-x-auto rounded-lg border border-dark-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-dark-800/50">
              <th className="text-left py-2 px-3 text-dark-400 font-medium">Navn</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">N&aring;v&aelig;rende</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">Simulert</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">Differanse</th>
              <th className="text-right py-2 px-3 text-dark-400 font-medium">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <ImpactRow
                key={i}
                name={nameKey(row)}
                current={row.current_revenue}
                simulated={row.simulated_revenue}
                difference={row.difference}
                differencePct={row.difference_pct}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────

export function SimulatorTab({ lists, groups }: SimulatorTabProps) {
  const [form, setForm] = useState<SimulatorForm>(INITIAL_FORM);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // Active (non-expired) price lists for the dropdown
  const activeLists = useMemo(
    () => lists.filter((l) => l.is_active),
    [lists],
  );

  // ── Form handlers ─────────────────────────────────────
  const update = useCallback(
    <K extends keyof SimulatorForm>(key: K, value: SimulatorForm[K]) =>
      setForm((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const handleReset = useCallback(() => {
    setForm(INITIAL_FORM);
    setResult(null);
    setError(null);
  }, []);

  const handleRun = useCallback(async () => {
    setError(null);
    setIsRunning(true);

    try {
      const proposed_rule: Record<string, any> = {
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

      const payload: Record<string, any> = {
        proposed_rule,
        sample_size: form.sample_size,
      };
      if (form.start_date) payload.start_date = form.start_date;
      if (form.end_date) payload.end_date = form.end_date;

      const response = await pricingApi.simulate(payload as any);
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Simuleringen feilet');
    } finally {
      setIsRunning(false);
    }
  }, [form]);

  // Validation
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

  // Summary highlight
  const revenueHighlight: 'positive' | 'negative' | 'neutral' =
    result ? (result.revenue_difference > 0 ? 'positive' : result.revenue_difference < 0 ? 'negative' : 'neutral') : 'neutral';

  // ── Render ────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Help / Info Header ────────────────────────────── */}
      <div className="flex items-center justify-between bg-primary-500/10 border border-primary-500/20 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center text-primary-400 text-xl">
            💡
          </div>
          <div>
            <h3 className="font-semibold text-primary-100">Prissimulator ("Hva-hvis" analyse)</h3>
            <p className="text-sm text-primary-300/80">
              Test effekten av prisendringer på historiske data før de aktiveres.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            showHelp 
              ? 'bg-primary-500 text-white' 
              : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
          }`}
        >
          <span>{showHelp ? 'Skjul hjelp' : 'Hvordan fungerer det?'}</span>
          <span className="text-xs">❓</span>
        </button>
      </div>

      {showHelp && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
          <div className="bg-dark-800/40 border border-dark-700 rounded-xl p-4">
            <div className="text-primary-400 font-bold mb-2">1. Definer regel</div>
            <p className="text-xs text-dark-400 leading-relaxed">
              Velg hvilke produkter og kunder den nye regelen skal gjelde for. Du kan simulere alt fra en global rabatt til en spesifikk pris for én enkelt kunde.
            </p>
          </div>
          <div className="bg-dark-800/40 border border-dark-700 rounded-xl p-4">
            <div className="text-primary-400 font-bold mb-2">2. Velg periode</div>
            <p className="text-xs text-dark-400 leading-relaxed">
              Systemet henter ekte ordrer fra den valgte perioden. Husk å velge et tidsrom hvor du vet det har vært salgsaktivitet for å få relevante resultater.
            </p>
          </div>
          <div className="bg-dark-800/40 border border-dark-700 rounded-xl p-4">
            <div className="text-primary-400 font-bold mb-2">3. Analyser effekt</div>
            <p className="text-xs text-dark-400 leading-relaxed">
              Simulatoren regner ut hva omsetningen <i>ville</i> vært med den nye regelen, og sammenligner det med hva kundene faktisk betalte.
            </p>
          </div>
        </div>
      )}

      {/* ── Configuration Panel ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Rule definition */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold">Foreslatt regel</h3>

          {/* Price list */}
          <div>
            <label className="label">Prisliste</label>
            <select
              value={form.price_list_id}
              onChange={(e) => update('price_list_id', e.target.value)}
              className="input w-full"
            >
              <option value="">Velg prisliste...</option>
              {activeLists.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>

          {/* Product scope */}
          <div>
            <label className="label">Produktomfang</label>
            <select
              value={form.scope}
              onChange={(e) => update('scope', e.target.value as SimulatorForm['scope'])}
              className="input w-full"
            >
              <option value="all">Alle produkter</option>
              <option value="product">Spesifikt produkt</option>
              <option value="category">Varegruppe</option>
            </select>
          </div>
          {form.scope === 'product' && (
            <input
              value={form.varekode}
              onChange={(e) => update('varekode', e.target.value)}
              className="input w-full"
              placeholder="Varekode (f.eks. V001)"
            />
          )}
          {form.scope === 'category' && (
            <input
              value={form.varegruppe}
              onChange={(e) => update('varegruppe', e.target.value)}
              className="input w-full"
              placeholder="Varegruppe"
            />
          )}

          {/* Customer target */}
          <div>
            <label className="label">Kundeomfang</label>
            <select
              value={form.target}
              onChange={(e) => update('target', e.target.value as SimulatorForm['target'])}
              className="input w-full"
            >
              <option value="all">Alle kunder</option>
              <option value="customer">Spesifikk kunde</option>
              <option value="group">Kundegruppe</option>
            </select>
          </div>
          {form.target === 'customer' && (
            <input
              value={form.kundenr}
              onChange={(e) => update('kundenr', e.target.value)}
              className="input w-full"
              placeholder="Kundenr"
            />
          )}
          {form.target === 'group' && (
            <select
              value={form.customer_group_id}
              onChange={(e) => update('customer_group_id', e.target.value)}
              className="input w-full"
            >
              <option value="">Velg gruppe...</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          )}

          {/* Min quantity */}
          <div>
            <label className="label">Min. antall</label>
            <input
              type="number"
              min={0}
              value={form.min_quantity}
              onChange={(e) => update('min_quantity', Number(e.target.value))}
              className="input w-full"
            />
          </div>
        </div>

        {/* Centre: Discount definition */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold">Rabatt / pris</h3>

          <div>
            <label className="label">Type</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => update('discount_type', 'percent')}
                className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                  form.discount_type === 'percent'
                    ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                    : 'border-dark-600 text-dark-400 hover:bg-dark-800'
                }`}
              >
                % Rabatt
              </button>
              <button
                type="button"
                onClick={() => update('discount_type', 'fixed')}
                className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                  form.discount_type === 'fixed'
                    ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                    : 'border-dark-600 text-dark-400 hover:bg-dark-800'
                }`}
              >
                Fast pris
              </button>
            </div>
          </div>

          {form.discount_type === 'percent' ? (
            <div>
              <label className="label">Rabatt (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={form.discount_percent}
                onChange={(e) => update('discount_percent', e.target.value)}
                className="input w-full"
                placeholder="f.eks. 15"
              />
            </div>
          ) : (
            <div>
              <label className="label">Fast pris (NOK)</label>
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.fixed_price}
                onChange={(e) => update('fixed_price', e.target.value)}
                className="input w-full"
                placeholder="f.eks. 249.00"
              />
            </div>
          )}

          {/* Visual summary */}
          <div className="bg-dark-800/60 rounded-lg p-4 mt-2">
            <p className="text-xs text-dark-400 uppercase tracking-wide mb-2">Regelsammendrag</p>
            <p className="text-sm text-dark-200">
              {form.discount_type === 'percent' && form.discount_percent
                ? `${form.discount_percent}% rabatt`
                : form.discount_type === 'fixed' && form.fixed_price
                  ? `Fast pris ${form.fixed_price} NOK`
                  : 'Konfigurer rabatt...'}
              {form.scope === 'product' && form.varekode ? ` for ${form.varekode}` : ''}
              {form.scope === 'category' && form.varegruppe ? ` for ${form.varegruppe}` : ''}
              {form.target === 'customer' && form.kundenr ? ` til kunde ${form.kundenr}` : ''}
              {form.target === 'group' && form.customer_group_id
                ? ` til ${groups.find(g => g.id === Number(form.customer_group_id))?.name ?? 'gruppe'}`
                : ''}
              {form.min_quantity > 0 ? ` ved ${form.min_quantity}+ stk` : ''}
            </p>
          </div>
        </div>

        {/* Right: Date range & controls */}
        <div className="card space-y-4">
          <h3 className="text-lg font-semibold">Tidsperiode</h3>

          <div>
            <label className="label">Fra dato</label>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => update('start_date', e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Til dato</label>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => update('end_date', e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="label">Antall ordrelinjer (maks)</label>
            <select
              value={form.sample_size}
              onChange={(e) => update('sample_size', Number(e.target.value))}
              className="input w-full"
            >
              <option value={500}>500</option>
              <option value={1000}>1 000</option>
              <option value={2500}>2 500</option>
              <option value={5000}>5 000</option>
            </select>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleRun}
              disabled={!canRun || isRunning}
              className="btn-primary flex-1"
            >
              {isRunning ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Simulerer...
                </span>
              ) : (
                'Kjor simulering'
              )}
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Nullstill
            </button>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Nåværende omsetning"
              value={NOK(result.current.total_revenue)}
            />
            <KpiCard
              label="Simulert omsetning"
              value={NOK(result.simulated.total_revenue)}
            />
            <KpiCard
              label="Differanse"
              value={NOK(result.revenue_difference)}
              subtext={pct(result.revenue_difference_pct)}
              highlight={revenueHighlight}
            />
            <KpiCard
              label="Ordrer analysert"
              value={result.orders_analysed.toLocaleString('nb-NO')}
              subtext={`${result.computation_time_ms}ms`}
            />
          </div>

          {/* Before/After bar comparison */}
          <div className="card">
            <h4 className="text-sm font-semibold text-dark-300 uppercase tracking-wide mb-4">
              Sammenligning
            </h4>
            <div className="space-y-4">
              <ComparisonBar
                label="Omsetning"
                current={result.current.total_revenue}
                simulated={result.simulated.total_revenue}
              />
              <ComparisonBar
                label="Gitt rabatt"
                current={result.current.total_discount}
                simulated={result.simulated.total_discount}
                inverse
              />
              <div className="grid grid-cols-2 gap-6 pt-2 border-t border-dark-700">
                <div className="text-center">
                  <p className="text-xs text-dark-400">Berørte linjer (n&aring;)</p>
                  <p className="text-lg font-bold">{result.current.affected_lines.toLocaleString('nb-NO')}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-dark-400">Berørte linjer (simulert)</p>
                  <p className="text-lg font-bold">{result.simulated.affected_lines.toLocaleString('nb-NO')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Impact tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ImpactTable
              title="Mest berørte kunder"
              data={result.top_customers}
              nameKey={(c) => `${c.kundenavn} (${c.kundenr})`}
            />
            <ImpactTable
              title="Mest berørte produkter"
              data={result.top_products}
              nameKey={(p) => `${p.varenavn} (${p.varekode})`}
            />
          </div>
        </div>
      )}

      {/* Empty state when no simulation has been run */}
      {!result && !isRunning && (
        <div className="card text-center py-16">
          <div className="text-4xl mb-4">🧪</div>
          <h3 className="text-lg font-semibold text-dark-200 mb-2">
            Prissimulator
          </h3>
          <p className="text-dark-400 max-w-md mx-auto">
            Konfigurer en prisregel i panelet ovenfor og klikk{' '}
            <span className="text-primary-400 font-medium">"Kjor simulering"</span>{' '}
            for å se hvordan endringen ville påvirket historisk omsetning.
          </p>
        </div>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Comparison bar (visual before / after)
// ────────────────────────────────────────────────────────────

function ComparisonBar({
  label,
  current,
  simulated,
  inverse = false,
}: {
  label: string;
  current: number;
  simulated: number;
  inverse?: boolean;
}) {
  const max = Math.max(current, simulated, 1);
  const currentPct = (current / max) * 100;
  const simulatedPct = (simulated / max) * 100;

  // When inverse (like discount), higher = worse → red
  const simColor = inverse
    ? simulated > current ? 'bg-red-500' : 'bg-green-500'
    : simulated >= current ? 'bg-green-500' : 'bg-red-500';

  return (
    <div>
      <div className="flex justify-between text-xs text-dark-400 mb-1">
        <span>{label}</span>
        <span>
          {NOK(current)} → {NOK(simulated)}
        </span>
      </div>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500 w-14">Nå</span>
          <div className="flex-1 bg-dark-800 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${currentPct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500 w-14">Simulert</span>
          <div className="flex-1 bg-dark-800 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${simColor}`}
              style={{ width: `${simulatedPct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
