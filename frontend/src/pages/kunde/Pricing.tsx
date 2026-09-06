import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CircleDollarSign,
  Layers,
  Percent,
  Search,
  Tag,
  Users,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { pricingApi } from '../../lib/api';
import { pricingKeys } from '../../lib/queryKeys';
import { formatMoneyNok } from '../../lib/formatters';
import { useAuth } from '../../context/useAuth';
import type { CustomerPriceRule } from '../../types/pricing';

function formatRuleValue(rule: CustomerPriceRule): string {
  if (rule.fixed_price != null) {
    return formatMoneyNok(rule.fixed_price);
  }
  if (rule.discount_percent != null) {
    // 0% rules have no price effect; label explicitly to match the catalog
    // badge-hidden state (catalog hides badge when !discount_applied).
    if (rule.discount_percent === 0) {
      return 'Ingen rabatt (0%)';
    }
    return `${rule.discount_percent} % rabatt`;
  }
  return '—';
}

function ruleScopeLabel(rule: CustomerPriceRule): string {
  if (rule.varekode) return `Vare ${rule.varekode}`;
  if (rule.varegruppe) return `Gruppe ${rule.varegruppe}`;
  return 'Alle varer';
}

function ruleTargetLabel(rule: CustomerPriceRule): string {
  if (rule.kundenr) return 'Din kunde';
  if (rule.customer_group_name) return rule.customer_group_name;
  return 'Generell';
}

export function KundePricing() {
  const { user } = useAuth();
  const kundenr = user?.kundenr ?? '';
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState('');

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: pricingKeys.customerRules(kundenr),
    queryFn: () => pricingApi.getCustomerRules(kundenr).then((res) => res.data),
    enabled: Boolean(kundenr),
    staleTime: 5 * 60_000,
  });

  const rules = data?.rules ?? [];
  const customer = data?.customer;

  // Degenerate rules (both fixed_price and discount_percent null) carry no
  // pricing effect — filter them out instead of rendering a "—" row.
  const validRules = useMemo(
    () => rules.filter((rule) => rule.fixed_price != null || rule.discount_percent != null),
    [rules],
  );
  const hiddenInvalidCount = rules.length - validRules.length;

  const priceLists = useMemo(() => {
    const names = new Set<string>();
    for (const rule of validRules) {
      if (rule.price_list_name) names.add(rule.price_list_name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, 'nb'));
  }, [validRules]);

  const filteredRules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return validRules.filter((rule) => {
      if (listFilter && rule.price_list_name !== listFilter) return false;
      if (!q) return true;
      const haystack = [
        rule.varekode,
        rule.varegruppe,
        rule.price_list_name,
        rule.customer_group_name,
        formatRuleValue(rule),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [validRules, search, listFilter]);

  const groupedRules = useMemo(() => {
    const groups = new Map<string, CustomerPriceRule[]>();
    for (const rule of filteredRules) {
      const key = rule.price_list_name ?? 'Ukjent prisliste';
      const list = groups.get(key) ?? [];
      list.push(rule);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filteredRules]);

  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste prisavtaler.';

  if (!kundenr) {
    return (
      <Layout title="Mine priser">
        <EmptyState
          title="Ingen kundekonto"
          description="Denne brukeren er ikke knyttet til et kundenummer."
        />
      </Layout>
    );
  }

  return (
    <Layout title="Mine priser">
      <div className="space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border border-dark-700/80 bg-gradient-to-br from-dark-900 via-dark-900 to-primary-950/30 p-6 sm:p-8">
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary-500/10 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-300">
                <CircleDollarSign className="h-3.5 w-3.5" aria-hidden />
                Dine avtalte priser
              </div>
              <h3 className="text-2xl font-bold text-white font-display">
                {customer?.kundenavn ?? 'Kunde'} <span className="text-dark-400 font-normal">· {kundenr}</span>
              </h3>
              <p className="text-sm text-dark-400 max-w-xl">
                Oversikt over prisregler som gjelder for deg — fra personlige avtaler, kundegruppe og generelle prislister.
                Kun visning; kontakt oss for endringer.
              </p>
              {customer?.customer_group_name && (
                <p className="inline-flex items-center gap-1.5 text-sm text-primary-300">
                  <Users className="h-4 w-4" aria-hidden />
                  Kundegruppe: {customer.customer_group_name}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[220px]">
              <div className="rounded-xl border border-dark-700/80 bg-dark-950/50 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">{validRules.length}</p>
                <p className="text-xs text-dark-400 mt-0.5">Regler</p>
              </div>
              <div className="rounded-xl border border-dark-700/80 bg-dark-950/50 px-4 py-3 text-center">
                <p className="text-2xl font-bold text-white tabular-nums">{priceLists.length}</p>
                <p className="text-xs text-dark-400 mt-0.5">Prislister</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="card space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-dark-500 pointer-events-none" aria-hidden />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Søk varekode, varegruppe, prisliste…"
                className="input w-full pl-10"
                aria-label="Søk i prisregler"
              />
            </div>
            <select
              value={listFilter}
              onChange={(e) => setListFilter(e.target.value)}
              className="input sm:w-56"
              aria-label="Filtrer prisliste"
            >
              <option value="">Alle prislister</option>
              {priceLists.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
          {(search || listFilter || hiddenInvalidCount > 0) && (
            <p className="text-sm text-dark-400">
              {(search || listFilter) && (
                <>Viser {filteredRules.length} av {validRules.length} regler</>
              )}
              {!(search || listFilter) && <>{validRules.length} regler</>}
              {hiddenInvalidCount > 0 && <> · {hiddenInvalidCount} ugyldige regler skjult</>}
            </p>
          )}
        </div>

        {isError && <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />}

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse space-y-3">
                <div className="h-5 w-40 rounded bg-dark-700/50" />
                <div className="h-16 rounded-lg bg-dark-700/30" />
                <div className="h-16 rounded-lg bg-dark-700/30" />
              </div>
            ))}
          </div>
        ) : validRules.length === 0 ? (
          <EmptyState
            title="Ingen prisregler funnet"
            description="Det er ikke registrert aktive prisavtaler for kontoen din ennå. Ta kontakt dersom du forventer spesialpriser."
          />
        ) : filteredRules.length === 0 ? (
          <EmptyState
            title="Ingen treff"
            description="Prøv et annet søk eller fjern filteret for prisliste."
            action={
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearch('');
                  setListFilter('');
                }}
              >
                Nullstill filter
              </button>
            }
          />
        ) : (
          <div className="space-y-6">
            {groupedRules.map(([listName, listRules]) => (
              <section key={listName} className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <Layers className="h-4 w-4 text-primary-400" aria-hidden />
                  <h4 className="text-sm font-semibold text-dark-200 uppercase tracking-wider">{listName}</h4>
                  <span className="text-xs text-dark-500">({listRules.length})</span>
                </div>

                {/* Desktop table */}
                <div className="hidden md:block card p-0 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-dark-800 text-left text-dark-400">
                          <th className="px-4 py-3 font-medium">Gjelder for</th>
                          <th className="px-4 py-3 font-medium">Målgruppe</th>
                          <th className="px-4 py-3 font-medium">Min. antall</th>
                          <th className="px-4 py-3 font-medium text-right">Pris / rabatt</th>
                        </tr>
                      </thead>
                      <tbody>
                        {listRules.map((rule) => (
                          <tr
                            key={rule.id}
                            className="border-b border-dark-800/60 last:border-0 hover:bg-dark-800/30 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5 text-white">
                                <Tag className="h-3.5 w-3.5 text-dark-500" aria-hidden />
                                {ruleScopeLabel(rule)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-dark-300">{ruleTargetLabel(rule)}</td>
                            <td className="px-4 py-3 text-dark-300 tabular-nums">{rule.min_quantity}+</td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={`inline-flex items-center gap-1 font-semibold ${
                                  rule.fixed_price != null ? 'text-emerald-400' : 'text-primary-400'
                                }`}
                              >
                                {rule.discount_percent != null && (
                                  <Percent className="h-3.5 w-3.5" aria-hidden />
                                )}
                                {formatRuleValue(rule)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-2">
                  {listRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-dark-700/80 bg-dark-900/60 p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-white">{ruleScopeLabel(rule)}</p>
                        <span
                          className={`text-sm font-bold shrink-0 ${
                            rule.fixed_price != null ? 'text-emerald-400' : 'text-primary-400'
                          }`}
                        >
                          {formatRuleValue(rule)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-dark-400">
                        <span className="rounded-md bg-dark-800 px-2 py-0.5">{ruleTargetLabel(rule)}</span>
                        <span className="rounded-md bg-dark-800 px-2 py-0.5">Min. {rule.min_quantity} stk</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
