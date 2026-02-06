import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { abbreviateNumber } from '../../lib/formatters';

interface LineChartProps {
  data: any[];
  xKey: string;
  yKey: string;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  title?: string;
  seriesName?: string;
  valueFormatter?: (value: number) => string;
  tickFormatter?: (value: number) => string;
  height?: number;
}

export function LineChart({
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
}: LineChartProps) {
  const defaultFormatter = (value: number) => 
    new Intl.NumberFormat('nb-NO').format(value);

  const tooltipFormatter = valueFormatter || defaultFormatter;
  const axisTick = tickFormatterProp || abbreviateNumber;

  return (
    <div className="chart-container">
      {title && <h3 className="text-lg font-semibold mb-4 text-dark-100">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#475569' }}
            tickLine={{ stroke: '#475569' }}
            label={xLabel ? { value: xLabel, position: 'bottom', fill: '#94a3b8' } : undefined}
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
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={color}
            strokeWidth={3}
            dot={{ fill: color, strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, fill: color, stroke: '#fff', strokeWidth: 2 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
