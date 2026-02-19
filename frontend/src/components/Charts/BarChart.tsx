import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

  const maxXTicks = 10;
  const tickInterval = data.length > maxXTicks ? Math.max(0, Math.ceil(data.length / maxXTicks) - 1) : 0;
  const rotateTicks = data.length > 8;

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
          dy={rotateTicks ? 18 : 14}
          textAnchor={rotateTicks ? 'end' : 'middle'}
          fill="#94a3b8"
          fontSize={11}
          fontWeight={500}
          transform={rotateTicks ? 'rotate(-35)' : undefined}
        >
          {truncated}
        </text>
      </g>
    );
  };

  return (
    <div className="chart-container bg-dark-900/40 backdrop-blur-sm border border-dark-800/50 rounded-xl p-5 shadow-lg shadow-black/10">
      {title && <h3 className="text-lg font-semibold mb-6 text-dark-100 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary-500 rounded-full"></span>
        {title}
      </h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBarChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: rotateTicks ? 30 : 10 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} strokeOpacity={0.4} />
          <XAxis
            dataKey={xKey}
            tick={renderXTick}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
            height={rotateTicks ? 60 : 30}
            label={xLabel ? { value: xLabel, position: 'bottom', fill: '#94a3b8', offset: 0 } : undefined}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={axisTick}
            width={60}
            label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#94a3b8' } : undefined}
          />
          <Tooltip
            cursor={{ fill: '#334155', opacity: 0.2 }}
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
              padding: '12px 16px',
            }}
            itemStyle={{
              color: '#f1f5f9',
              fontSize: '13px',
              fontWeight: '600',
              paddingTop: '4px',
            }}
            labelStyle={{
              color: '#94a3b8',
              fontSize: '12px',
              marginBottom: '8px',
              fontWeight: '500',
              borderBottom: '1px solid rgba(51, 65, 85, 0.5)',
              paddingBottom: '8px',
            }}
            formatter={(value: number) => [tooltipFormatter(value), seriesName]}
          />
          <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={60}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={color} fillOpacity={0.9} />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
