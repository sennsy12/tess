import { useState, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronUp, Users, List, Percent, Link2 } from 'lucide-react';
import type { Tab } from '../../../../types/pricing';

const STORAGE_KEY = 'pricing-guide-collapsed';

interface PricingGuideProps {
  stats: {
    groups: number;
    lists: number;
    activeLists: number;
    assignedCustomers: number;
  };
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
}

const WORKFLOW_STEPS: {
  step: number;
  tab: Tab;
  label: string;
  short: string;
  Icon: typeof Users;
}[] = [
  {
    step: 1,
    tab: 'groups',
    label: 'Kundegrupper',
    short: 'Opprett grupper som f.eks. «Grossist» eller «VIP»',
    Icon: Users,
  },
  {
    step: 2,
    tab: 'lists',
    label: 'Prislister',
    short: 'Lag prislister med prioritet og gyldighetsperiode',
    Icon: List,
  },
  {
    step: 3,
    tab: 'rules',
    label: 'Prisregler',
    short: 'Definer rabatter og faste priser per produkt og kunde',
    Icon: Percent,
  },
  {
    step: 4,
    tab: 'customers',
    label: 'Tildeling',
    short: 'Koble kunder til riktig kundegruppe',
    Icon: Link2,
  },
];

export function PricingGuide({ stats, activeTab, onNavigate }: PricingGuideProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const setupComplete =
    stats.groups > 0 && stats.activeLists > 0;

  return (
    <div className="card border-primary-500/20 bg-gradient-to-br from-primary-500/5 to-transparent">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-dark-50">Slik fungerer prisstyring</h2>
          <p className="mt-1 text-sm text-dark-400 max-w-2xl">
            Priser beregnes i fire steg: grupper → lister → regler → tildeling.
            Start med steg 1 og jobb deg nedover.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-dark-400 transition-colors hover:bg-dark-800 hover:text-dark-200"
        >
          {collapsed ? 'Vis veiledning' : 'Skjul'}
          {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
      </div>

      {!collapsed && (
        <div className="mt-5 space-y-5">
          {/* Workflow steps */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STEPS.map(({ step, tab, label, short, Icon }, idx) => {
              const isActive = activeTab === tab;
              const isPast =
                WORKFLOW_STEPS.findIndex((s) => s.tab === activeTab) > idx;

              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => onNavigate(tab)}
                  className={`group relative rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? 'border-primary-500/50 bg-primary-500/10 ring-1 ring-primary-500/30'
                      : isPast
                        ? 'border-green-500/30 bg-green-500/5 hover:border-green-500/50'
                        : 'border-dark-700 bg-dark-800/40 hover:border-dark-600 hover:bg-dark-800/60'
                  }`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        isActive
                          ? 'bg-primary-500 text-white'
                          : isPast
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-dark-700 text-dark-400'
                      }`}
                    >
                      {step}
                    </span>
                    <Icon
                      className={`h-4 w-4 ${
                        isActive ? 'text-primary-400' : 'text-dark-500 group-hover:text-dark-300'
                      }`}
                    />
                  </div>
                  <p className="font-medium text-dark-100">{label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-dark-400">{short}</p>
                  {idx < WORKFLOW_STEPS.length - 1 && (
                    <span
                      className="absolute -right-2 top-1/2 hidden -translate-y-1/2 text-dark-600 lg:block"
                      aria-hidden
                    >
                      →
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Kundegrupper" value={stats.groups} hint={stats.groups === 0 ? 'Start her' : undefined} />
            <StatCard label="Prislister" value={stats.lists} sub={`${stats.activeLists} aktive`} />
            <StatCard
              label="Kunder tildelt"
              value={stats.assignedCustomers}
              hint={stats.assignedCustomers === 0 && stats.groups > 0 ? 'Tildel kunder' : undefined}
            />
            <StatCard
              label="Oppsett"
              value={setupComplete ? <Check className="h-7 w-7" aria-label="Fullført" /> : '—'}
              hint={setupComplete ? 'Grunnlag klart' : 'Fullfør steg 1–2'}
              highlight={setupComplete ? 'positive' : 'neutral'}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  hint,
  highlight,
}: {
  label: string;
  value: number | ReactNode;
  sub?: string;
  hint?: string;
  highlight?: 'positive' | 'neutral';
}) {
  return (
    <div className="rounded-lg border border-dark-700 bg-dark-800/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-dark-500">{label}</p>
      <p
        className={`mt-1 text-2xl font-bold ${
          highlight === 'positive' ? 'text-green-400' : 'text-dark-100'
        }`}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-dark-400">{sub}</p>}
      {hint && <p className="mt-0.5 text-xs text-primary-400">{hint}</p>}
    </div>
  );
}
