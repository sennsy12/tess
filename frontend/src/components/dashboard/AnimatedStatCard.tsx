import { useCountUp } from '../../hooks/useCountUp';
import { Sparkline } from '../Sparkline';
import { formatNumberNb } from '../../lib/formatters';

// ────────────────────────────────────────────────────────────
// Animated stat card with optional sparkline
// ────────────────────────────────────────────────────────────

interface AnimatedStatCardProps {
  label: string;
  value: number;
  /** Format the animated number for display (default: formatNumberNb) */
  formatter?: (n: number) => string;
  /** Optional sparkline data */
  sparkData?: Record<string, any>[];
  /** Key in sparkData to plot */
  sparkKey?: string;
  /** Sparkline colour */
  sparkColor?: string;
  /** Extra CSS classes for the stat-card wrapper */
  className?: string;
  /** Extra CSS classes for the label */
  labelClassName?: string;
}

export function AnimatedStatCard({
  label,
  value,
  formatter = formatNumberNb,
  sparkData,
  sparkKey = 'value',
  sparkColor = '#6366f1',
  className = '',
  labelClassName = '',
}: AnimatedStatCardProps) {
  const animated = useCountUp(value);

  return (
    <div className={`stat-card ${className}`}>
      <div className={`stat-label ${labelClassName}`}>{label}</div>
      <div className="stat-value">{formatter(animated)}</div>
      {sparkData && sparkData.length >= 2 && (
        <div className="mt-2">
          <Sparkline data={sparkData} dataKey={sparkKey} color={sparkColor} height={28} />
        </div>
      )}
    </div>
  );
}
