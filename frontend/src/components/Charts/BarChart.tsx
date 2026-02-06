import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { abbreviateNumber, truncateLabel } from '../../lib/formatters';

interface BarChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  title?: string;
  seriesName?: string;
  valueFormatter?: (value: number) => string;
  /** Formatter for Y-axis ticks (defaults to abbreviateNumber) */
  tickFormatter?: (value: number) => string;
  height?: number;
}

export function BarChart({
  data,
  xKey,
  yKey,
  xLabel,
  yLabel,
  color = '#6366f1',
  title,
  seriesName = 'Verdi',
  valueFormatter,
  tickFormatter: tickFormatterProp,
  height = 300,
}: BarChartProps) {
  const defaultFormatter = (value: number) => 
    new Intl.NumberFormat('nb-NO').format(value);

  // Full-precision formatter for tooltips
  const tooltipFormatter = valueFormatter || defaultFormatter;
  // Abbreviated formatter for Y-axis ticks
  const axisTick = tickFormatterProp || abbreviateNumber;

  // Custom X-axis tick that truncates long labels
  const renderXTick = (props: any) => {
    const { x, y, payload } = props;
    const label = String(payload.value);
    const truncated = truncateLabel(label, 12);
    return (
      <g transform={`translate(${x},${y})`}>
        <title>{label}</title>
        <text
          x={0}
          y={0}
          dy={14}
          textAnchor="middle"
          fill="#94a3b8"
          fontSize={11}
        >
          {truncated}
        </text>
      </g>
    );
  };

  return (
    <div className="chart-container">
      {title && <h3 className="text-lg font-semibold mb-4 text-dark-100">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={renderXTick}
            axisLine={{ stroke: '#475569' }}
            tickLine={{ stroke: '#475569' }}
            interval={0}
            label={xLabel ? { value: xLabel, position: 'bottom', fill: '#94a3b8', offset: 0 } : undefined}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#475569' }}
            tickLine={{ stroke: '#475569' }}
            tickFormatter={axisTick}
            width={65}
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8' } : undefined}
          />
          <Tooltip
            cursor={{ fill: '#334155', opacity: 0.4 }}
            contentStyle={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              padding: '12px',
            }}
            itemStyle={{
              color: '#f1f5f9',
              fontSize: '14px',
              fontWeight: '600',
            }}
            labelStyle={{
              color: '#94a3b8',
              fontSize: '12px',
              marginBottom: '4px',
              fontWeight: '500',
            }}
            formatter={(value: number) => [tooltipFormatter(value), seriesName]}
          />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
