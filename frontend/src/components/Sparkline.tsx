import { useId } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  YAxis,
} from 'recharts';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';

interface SparklineProps {
  /** Array of data points, each must have the key specified by `dataKey` */
  data: Record<string, any>[];
  /** Which field to plot */
  dataKey: string;
  /** Line/fill colour (default: primary indigo) */
  color?: string;
  /** Container height in px (default 32) */
  height?: number;
  /** Container width as CSS string (default '100%') */
  width?: string;
}

/**
 * A tiny inline area chart for use inside stat cards.
 * Shows the trend without axes, labels, or tooltips.
 */
export function Sparkline({
  data,
  dataKey,
  color = '#6366f1',
  height = 32,
  width = '100%',
}: SparklineProps) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  // Phase 0: unique gradient id per instance — the old color-derived id
  // (`spark-6366f1`) collided whenever two sparklines shared a colour.
  const gradientId = `spark-${rawId}`;
  const reduceMotion = usePrefersReducedMotion();
  if (!data || data.length < 2) return null;

  return (
    <div style={{ width, height }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#${gradientId})`}
            isAnimationActive={!reduceMotion}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
