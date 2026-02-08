import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { abbreviateNumber } from '../../lib/formatters';

/** Describes one line/series in the chart. */
export interface LineSeries {
  dataKey: string;
  name: string;
  color: string;
  /** Dash pattern (e.g. "5 5") for dashed lines */
  strokeDasharray?: string;
}

interface LineChartProps {
  data: any[];
  xKey: string;
  /** Single-series shorthand (ignored when `series` is provided) */
  yKey?: string;
  xLabel?: string;
  yLabel?: string;
  color?: string;
  title?: string;
  seriesName?: string;
  /** Multi-series definition — takes precedence over yKey/color/seriesName */
  series?: LineSeries[];
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
  series,
  valueFormatter,
  tickFormatter: tickFormatterProp,
  height = 300,
}: LineChartProps) {
  const defaultFormatter = (value: number) => 
    new Intl.NumberFormat('nb-NO').format(value);

  const tooltipFormatter = valueFormatter || defaultFormatter;
  const axisTick = tickFormatterProp || abbreviateNumber;

  // Resolve series: either explicit multi-series or fallback to single yKey
  const resolvedSeries: LineSeries[] = series ?? [
    { dataKey: yKey ?? 'value', name: seriesName, color },
  ];

  const showLegend = resolvedSeries.length > 1;

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
              fontSize: '14px',
              fontWeight: '600',
            }}
            labelStyle={{
              color: '#94a3b8',
              fontSize: '12px',
              marginBottom: '4px',
              fontWeight: '500',
            }}
            formatter={(value: number, name: string) => {
              const s = resolvedSeries.find((rs) => rs.dataKey === name);
              return [tooltipFormatter(value), s?.name ?? name];
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '8px', fontSize: '12px' }}
              formatter={(value: string) => {
                const s = resolvedSeries.find((rs) => rs.dataKey === value);
                return s?.name ?? value;
              }}
            />
          )}
          {resolvedSeries.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.dataKey}
              stroke={s.color}
              strokeWidth={2.5}
              strokeDasharray={s.strokeDasharray}
              dot={{ fill: s.color, strokeWidth: 2, r: 3 }}
              activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
