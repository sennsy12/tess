import { ReactNode } from 'react';
import { useCountUp } from '../hooks/useCountUp';
import { Sparkline } from './Sparkline';

interface PremiumStatCardProps {
  label: string;
  /** Pre-formatted display value (used when `numericValue` is not set). */
  value: string;
  /** When set, the value counts up from zero on mount using `format`. */
  numericValue?: number;
  format?: (value: number) => string;
  /** Optional secondary line under the value (badges, deltas). */
  sub?: ReactNode;
  /** Accent treatment: 'gold' tints the corner glow and value. */
  accent?: 'indigo' | 'gold';
  /** Optional series rendered as a background sparkline. */
  sparkData?: Record<string, unknown>[];
  sparkDataKey?: string;
  title?: string;
}

/**
 * Executive Dark stat card: large light display numeral, soft gold corner
 * glow, optional count-up animation and background sparkline.
 */
export function PremiumStatCard({
  label,
  value,
  numericValue,
  format,
  sub,
  accent = 'indigo',
  sparkData,
  sparkDataKey = 'value',
  title,
}: PremiumStatCardProps) {
  const animated = useCountUp(numericValue ?? 0);
  const displayValue =
    numericValue !== undefined && format ? format(animated) : value;

  return (
    <div className="stat-card group" title={title}>
      {/* Background sparkline, fades in on hover */}
      {sparkData && sparkData.length > 1 && (
        <div className="absolute inset-x-0 bottom-0 h-10 opacity-40 group-hover:opacity-70 transition-opacity duration-300 pointer-events-none">
          <Sparkline data={sparkData} dataKey={sparkDataKey} height={40} />
        </div>
      )}

      <p className="stat-label">{label}</p>
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
