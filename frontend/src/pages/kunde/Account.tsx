import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  Hash,
  KeyRound,
  Package,
  Shield,
  Sparkles,
  User,
  Warehouse,
} from 'lucide-react';
import { Layout } from '../../components/Layout';
import { QueryErrorBanner } from '../../components/QueryErrorBanner';
import { EmptyState } from '../../components/EmptyState';
import { customersApi } from '../../lib/api/customers';
import { accountKeys } from '../../lib/queryKeys';
import { useAuth } from '../../context/useAuth';
import {
  companyInitials,
  formatProfileDate,
  groupTierStyle,
  profileCurrency,
} from '../../lib/companyDisplay';

function ProfileSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-48 rounded-2xl bg-dark-800/40" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 rounded-xl bg-dark-800/40" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="h-40 rounded-xl bg-dark-800/40" />
        <div className="h-40 rounded-xl bg-dark-800/40" />
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent = 'text-white',
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-dark-700/70 bg-dark-900/50 p-4 backdrop-blur-sm">
      <p className="text-[11px] uppercase tracking-wider text-dark-500 font-medium">{label}</p>
      <p className={`mt-1 text-xl font-bold tabular-nums ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-dark-500">{hint}</p>}
    </div>
  );
}

export function KundeAccount() {
  const { user } = useAuth();
  const kundenr = user?.kundenr ?? '';

  const { data: profile, isLoading, isError, error, refetch } = useQuery({
    queryKey: accountKeys.profile(kundenr),
    queryFn: () => customersApi.getMyProfile().then((res) => res.data),
    enabled: Boolean(kundenr),
    staleTime: 5 * 60_000,
  });

  const errorMessage =
    (error as { response?: { data?: { error?: string } } })?.response?.data?.error ||
    'Kunne ikke laste kontoprofil.';

  if (!kundenr) {
    return (
      <Layout title="Min konto">
        <EmptyState
          title="Ingen kundekonto"
          description="Denne brukeren er ikke knyttet til et kundenummer."
        />
      </Layout>
    );
  }

  const tier = groupTierStyle(profile?.customer_group_name);
  const initials = companyInitials(profile?.kundenavn);
  const stats = profile?.stats;

  return (
    <Layout title="Min konto">
      <div className="space-y-6 max-w-5xl mx-auto">
        {isError && <QueryErrorBanner message={errorMessage} onRetry={() => refetch()} />}

        {isLoading ? (
          <ProfileSkeleton />
        ) : profile ? (
          <>
            {/* Passport header — distinct emerald/teal identity card */}
            <section className="relative overflow-hidden rounded-2xl border border-dark-700/80">
              <div
                className={`absolute inset-0 bg-gradient-to-br ${tier.ring} opacity-40`}
                aria-hidden
              />
              <div className={`absolute -left-20 top-0 h-56 w-56 rounded-full ${tier.glow} blur-3xl`} aria-hidden />
              <div className="absolute -right-10 bottom-0 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl" aria-hidden />

              {/* Decorative passport stripes */}
              <div
                className="absolute top-0 right-0 w-32 h-full opacity-[0.07] pointer-events-none"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(-45deg, transparent, transparent 8px, white 8px, white 9px)',
                }}
                aria-hidden
              />

              <div className="relative p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row gap-6 sm:items-center">
                  {/* Avatar ring */}
                  <div className="relative shrink-0 mx-auto sm:mx-0">
                    <div
                      className={`absolute -inset-1 rounded-2xl bg-gradient-to-br ${tier.ring} opacity-80 blur-sm`}
                      aria-hidden
                    />
                    <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-2xl border border-white/10 bg-dark-950/80 shadow-2xl">
                      <span className="text-3xl sm:text-4xl font-bold font-display text-white tracking-tight">
                        {initials}
                      </span>
                    </div>
                  </div>

                  <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tier.badge}`}
                      >
                        <Sparkles className="h-3.5 w-3.5" aria-hidden />
                        {profile.customer_group_name ?? tier.label}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-dark-600 bg-dark-900/60 px-2.5 py-1 text-xs font-mono text-dark-300">
                        <Hash className="h-3 w-3" aria-hidden />
                        {profile.kundenr}
                      </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-bold text-white font-display tracking-tight truncate">
                      {profile.kundenavn ?? 'Ukjent firma'}
                    </h2>

                    <p className="text-sm text-dark-400 max-w-lg">
                      {profile.customer_group_description ??
                        'Din bedriftsprofil i TESS — avtaler, handelshistorikk og portaltilgang samlet på ett sted.'}
                    </p>

                    <div className="flex flex-wrap justify-center sm:justify-start gap-4 text-xs text-dark-500">
                      {stats?.first_order_date && (
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                          Kunde siden {formatProfileDate(stats.first_order_date)}
                        </span>
                      )}
                      {profile.account_created_at && (
                        <span className="inline-flex items-center gap-1">
                          <Shield className="h-3.5 w-3.5" aria-hidden />
                          Portal fra {formatProfileDate(profile.account_created_at)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Activity bento */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatTile
                label="Ordrer totalt"
                value={String(stats?.order_count ?? 0)}
                hint={stats?.last_order_date ? `Siste: ${formatProfileDate(stats.last_order_date)}` : undefined}
              />
              <StatTile
                label="Omsetning"
                value={profileCurrency(stats?.total_revenue ?? 0)}
                accent="text-emerald-400"
              />
              <StatTile
                label="Aktive ordrer"
                value={String(stats?.active_orders ?? 0)}
                hint="Ikke fakturert / kansellert"
                accent="text-cyan-400"
              />
              <StatTile
                label="Kontakter"
                value={String(profile.contact_refs.length)}
                hint="Fra ordrehistorikk"
              />
            </section>

            {/* Detail bento grid */}
            <section className="grid lg:grid-cols-2 gap-4">
              {/* Trading partners */}
              <div className="rounded-2xl border border-dark-700/80 bg-dark-900/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-emerald-400" aria-hidden />
                  <h3 className="font-semibold text-white">Handelspartnere</h3>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 py-2 border-b border-dark-800/80">
                    <dt className="text-dark-400">Primær firmaenhet</dt>
                    <dd className="font-medium text-dark-100 text-right">{profile.primary_firma ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2 border-b border-dark-800/80">
                    <dt className="text-dark-400 flex items-center gap-1">
                      <Warehouse className="h-3.5 w-3.5" aria-hidden />
                      Hovedlager
                    </dt>
                    <dd className="font-medium text-dark-100 text-right">{profile.primary_lager ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-dark-400">Kundegruppe</dt>
                    <dd className="font-medium text-dark-100 text-right">
                      {profile.customer_group_name ?? 'Ikke tildelt'}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Portal access */}
              <div className="rounded-2xl border border-dark-700/80 bg-dark-900/40 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-cyan-400" aria-hidden />
                  <h3 className="font-semibold text-white">Portaltilgang</h3>
                </div>
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between gap-4 py-2 border-b border-dark-800/80">
                    <dt className="text-dark-400 flex items-center gap-1">
                      <User className="h-3.5 w-3.5" aria-hidden />
                      Brukernavn
                    </dt>
                    <dd className="font-mono text-dark-100">{profile.portal_username ?? user?.username ?? '—'}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2 border-b border-dark-800/80">
                    <dt className="text-dark-400">Kundenummer</dt>
                    <dd className="font-mono text-dark-100">{profile.kundenr}</dd>
                  </div>
                  <div className="flex justify-between gap-4 py-2">
                    <dt className="text-dark-400">Konto opprettet</dt>
                    <dd className="text-dark-100">{formatProfileDate(profile.account_created_at)}</dd>
                  </div>
                </dl>
                <Link
                  to="/kunde/settings"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-400 hover:text-primary-300 transition-colors"
                >
                  Endre passord
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            </section>

            {/* Contact refs from orders */}
            <section className="rounded-2xl border border-dark-700/80 bg-dark-900/40 p-5 sm:p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-teal-400" aria-hidden />
                    <h3 className="font-semibold text-white">Kontakter & referanser</h3>
                  </div>
                  <p className="text-sm text-dark-400 mt-1">
                    Personer og referanser brukt på dine ordrer — hentet fra ordrehistorikk, ikke redigerbart her.
                  </p>
                </div>
              </div>

              {profile.contact_refs.length > 0 ? (
                <ul className="flex flex-wrap gap-2">
                  {profile.contact_refs.map((ref) => (
                    <li
                      key={ref}
                      className="inline-flex items-center gap-1.5 rounded-full border border-dark-600 bg-dark-800/60 px-3 py-1.5 text-sm text-dark-200"
                    >
                      <User className="h-3.5 w-3.5 text-dark-500" aria-hidden />
                      {ref}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-dark-500 italic">
                  Ingen kontaktreferanser registrert på ordrer ennå.
                </p>
              )}
            </section>

            {/* Quick actions — horizontal scroll on mobile */}
            <section className="flex gap-3 overflow-x-auto pb-1 snap-x snap-mandatory scrollbar-thin">
              {[
                { to: '/kunde/orders', label: 'Se ordrer', Icon: ClipboardList, desc: 'Full oversikt' },
                { to: '/kunde/pricing', label: 'Mine priser', Icon: CircleDollarSign, desc: 'Avtalte priser' },
                { to: '/kunde/settings', label: 'Innstillinger', Icon: KeyRound, desc: 'Passord & profil' },
              ].map(({ to, label, Icon, desc }) => (
                <Link
                  key={to}
                  to={to}
                  className="group snap-start shrink-0 min-w-[160px] flex-1 rounded-xl border border-dark-700/80 bg-dark-900/50 p-4 hover:border-emerald-500/40 hover:bg-dark-800/50 transition-all"
                >
                  <Icon className="h-5 w-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" aria-hidden />
                  <p className="font-medium text-white text-sm">{label}</p>
                  <p className="text-xs text-dark-500 mt-0.5">{desc}</p>
                </Link>
              ))}
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
