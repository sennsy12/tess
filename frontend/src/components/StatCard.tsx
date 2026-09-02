import { Suspense, lazy, type ReactNode } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import { formatNumberNb } from '../lib/formatters';

// Lazy: Sparkline pulls in recharts. Pages that render StatCard without any
// other chart (e.g. order lists) should not pay for the charts chunk.
const Sparkline = lazy(() => import('./Sparkline').then((m) => ({ default: m.Sparkline })));

export type StatCardAccent = 'indigo' | 'gold';

interface StatCardProps {
  label: string;
  /** Pre-formatted display value (fallback when `numericValue` is not set). */
  value: string;
  /** When set, the value counts up from zero on mount using `format`. */
  numericValue?: number;
  /** Formats the animated number (default: Norwegian grouped integer). */
  format?: (value: number) => string;
  /** Optional secondary line under the value (badges, deltas). */
  sub?: ReactNode;
  /** Accent treatment: 'gold' tints the corner glow and value. */
  accent?: StatCardAccent;
  /** Optional series rendered as a background sparkline. */
  sparkData?: Record<string, unknown>[];
  sparkDataKey?: string;
  /** Sparkline colour (default: primary indigo). */
  sparkColor?: string;
  title?: string;
  /** Extra classes for the card wrapper (e.g. legacy gradient themes). */
  className?: string;
  /** Extra classes for the label. */
  labelClassName?: string;
}

/**
 * Executive Dark stat card: large light display numeral, soft gold corner
 * glow, optional count-up animation and background sparkline.
 *
 * Unifies the former `PremiumStatCard` and `dashboard/AnimatedStatCard`,
 * which had drifted into two prop dialects (`format` vs `formatter`,
 * `sparkDataKey` vs `sparkKey`, background vs inline sparkline).
 */
export function StatCard({
  label,
  value,
  numericValue,
  format = formatNumberNb,
  sub,
  accent = 'indigo',
  sparkData,
  sparkDataKey = 'value',
  sparkColor = '#6366f1',
  title,
  className = '',
  labelClassName = '',
}: StatCardProps) {
  const animated = useCountUp(numericValue ?? 0);
  const displayValue = numericValue !== undefined ? format(animated) : value;

  return (
    <div className={`stat-card group ${className}`} title={title}>
      {/* Background sparkline, fades in on hover */}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-10 opacity-40 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none">
          <Suspense fallback={<div className="h-10" aria-hidden />}>
            <Sparkline data={sparkData} dataKey={sparkDataKey} color={sparkColor} height={40} />
          </Suspense>
        </div>
      )}

      <p className={`stat-label ${labelClassName}`}>{label}</p>
      <p
        className={`stat-display text-2xl xl:text-3xl truncate ${
          accent === 'gold' ? 'text-gold-300' : 'text-white'
        }`}
        title={displayValue}
      >
        {displayValue}
      </p>
      {sub && <div className="text-xs mt-1 relative z-10">{sub}</div>}
    </div>
  );
}
