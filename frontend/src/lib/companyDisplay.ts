/** Visual helpers for kunde company profile. */

export function companyInitials(name: string | null | undefined): string {
  if (!name?.trim()) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export type GroupTierStyle = {
  badge: string;
  ring: string;
  glow: string;
  label: string;
};

const DEFAULT_TIER: GroupTierStyle = {
  badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  ring: 'from-emerald-500/30 via-teal-500/20 to-cyan-500/30',
  glow: 'bg-emerald-500/15',
  label: 'Kunde',
};

const TIER_MAP: Record<string, GroupTierStyle> = {
  vip: {
    badge: 'border-amber-400/50 bg-amber-500/15 text-amber-200',
    ring: 'from-amber-400/40 via-yellow-500/25 to-orange-500/30',
    glow: 'bg-amber-500/15',
    label: 'VIP-kunde',
  },
  wholesale: {
    badge: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    ring: 'from-sky-500/30 via-blue-500/20 to-indigo-500/25',
    glow: 'bg-sky-500/15',
    label: 'Engro',
  },
  standard: {
    badge: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    ring: 'from-emerald-500/30 via-teal-500/20 to-cyan-500/30',
    glow: 'bg-emerald-500/15',
    label: 'Standard',
  },
};

export function groupTierStyle(groupName: string | null | undefined): GroupTierStyle {
  if (!groupName) return DEFAULT_TIER;
  const key = groupName.trim().toLowerCase();
  return TIER_MAP[key] ?? DEFAULT_TIER;
}

export function formatProfileDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const profileCurrency = (value: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);
