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
    <div className="chart-container bg-dark-900/40 backdrop-blur-sm border border-dark-800/50 rounded-xl p-5 shadow-lg shadow-black/10">
      {title && <h3 className="text-lg font-semibold mb-6 text-dark-100 flex items-center gap-2">
        <span className="w-1 h-5 bg-primary-500 rounded-full"></span>
        {title}
      </h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {resolvedSeries.map((s, i) => (
              <linearGradient key={`gradient-${i}`} id={`color-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={s.color} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={s.color} stopOpacity={0}/>
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} strokeOpacity={0.4} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            dy={10}
            label={xLabel ? { value: xLabel, position: 'bottom', fill: '#94a3b8' } : undefined}
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
            cursor={{ stroke: '#475569', strokeWidth: 1, strokeDasharray: '4 4' }}
            contentStyle={{
              backgroundColor: 'rgba(15, 23, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)',
              padding: '12px 16px',
            }}
            itemStyle={{
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
            formatter={(value: number, name: string) => {
              const s = resolvedSeries.find((rs) => rs.dataKey === name);
              return [tooltipFormatter(value), s?.name ?? name];
            }}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }}
              iconType="circle"
              formatter={(value: string) => {
                const s = resolvedSeries.find((rs) => rs.dataKey === value);
                return <span className="text-dark-300 font-medium ml-1">{s?.name ?? value}</span>;
              }}
            />
          )}
          {resolvedSeries.map((s, _i) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.dataKey}
              stroke={s.color}
              strokeWidth={3}
              strokeDasharray={s.strokeDasharray}
              dot={{ fill: '#0f172a', stroke: s.color, strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: s.color, stroke: '#fff', strokeWidth: 2, filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))' }}
              isAnimationActive={true}
              animationDuration={1500}
            />
          ))}
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
