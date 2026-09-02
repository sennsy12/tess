import { useMemo, useState } from 'react';
import { LineChart } from '../../../../components/Charts';
import type { CustomerGroup, PriceList } from '../../../../types/pricing';
import { formatMoneyNok } from '../../../../lib/formatters';
import { usePriceSimulator } from './simulator/usePriceSimulator';
import { RuleDefinitionCard } from './simulator/RuleDefinitionCard';
import { DiscountCard } from './simulator/DiscountCard';
import { PeriodCard } from './simulator/PeriodCard';
import { KpiCard } from './simulator/KpiCard';
import { ImpactTable } from './simulator/ImpactTable';
import { ComparisonBar } from './simulator/ComparisonBar';
import { pct } from './simulator/display';

interface SimulatorTabProps {
  lists: PriceList[];
  groups: CustomerGroup[];
}

export function SimulatorTab({ lists, groups }: SimulatorTabProps) {
  const { form, update, reset, run, canRun, result, isRunning, error } = usePriceSimulator();
  const [showHelp, setShowHelp] = useState(false);

  const activeLists = useMemo(
    () => lists.filter((l) => l.is_active),
    [lists],
  );

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
        <RuleDefinitionCard form={form} update={update} activeLists={activeLists} groups={groups} />
        <DiscountCard form={form} update={update} groups={groups} />
        <PeriodCard
          form={form}
          update={update}
          canRun={canRun}
          isRunning={isRunning}
          onRun={() => void run()}
          onReset={reset}
          error={error}
        />
      </div>

      {/* ── Results ───────────────────────────────────────── */}
      {result && (
        <div className="space-y-6 animate-fade-in">
          {/* KPI summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard
              label="Nåværende omsetning"
              value={formatMoneyNok(result.current.total_revenue)}
            />
            <KpiCard
              label="Simulert omsetning"
              value={formatMoneyNok(result.simulated.total_revenue)}
            />
            <KpiCard
              label="Differanse"
              value={formatMoneyNok(result.revenue_difference)}
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

          {/* Revenue trend over time */}
          {result.trend.length > 1 && (
            <div className="card">
              <LineChart
                title="Omsetning over tid"
                data={result.trend}
                xKey="date"
                series={[
                  { dataKey: 'current_revenue', name: 'Faktisk omsetning', color: '#3b82f6' },
                  { dataKey: 'simulated_revenue', name: 'Simulert omsetning', color: '#22c55e', strokeDasharray: '6 3' },
                ]}
                valueFormatter={(v) => formatMoneyNok(v)}
                height={320}
              />
            </div>
          )}

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
            <span className="text-primary-400 font-medium">"Simuler"</span>{' '}
            for å se hvordan endringen ville påvirket historisk omsetning.
          </p>
        </div>
      )}
    </div>
  );
}
