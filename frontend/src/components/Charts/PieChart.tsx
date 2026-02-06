import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { truncateLabel } from '../../lib/formatters';

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

interface PieChartProps {
  data: any[];
  nameKey: string;
  valueKey: string;
  title?: string;
  seriesName?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}

export function PieChart({
  data,
  nameKey,
  valueKey,
  title,
  seriesName = 'Verdi',
  valueFormatter,
  height = 340,
}: PieChartProps) {
  const defaultFormatter = (value: number) => 
    new Intl.NumberFormat('nb-NO').format(value);

  const formatter = valueFormatter || defaultFormatter;

  // Custom label renderer: truncates name, shows percent
  const renderLabel = ({ name, percent, cx, x, y }: any) => {
    const truncated = truncateLabel(name, 10);
    // Shift labels a bit further from center so they don't overlap the donut
    const isRight = x > cx;
    return (
      <text
        x={x}
        y={y}
        fill="#cbd5e1"
        fontSize={11}
        textAnchor={isRight ? 'start' : 'end'}
        dominantBaseline="central"
      >
        <title>{name}</title>
        {`${truncated}: ${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Custom legend renderer: truncated labels with tooltip via title attr
  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-3">
        {payload.map((entry: any, index: number) => (
          <span
            key={`legend-${index}`}
            className="flex items-center gap-1.5 text-xs text-dark-300"
            title={entry.value}
          >
            <span
              className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: entry.color }}
            />
            {truncateLabel(entry.value, 14)}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="chart-container">
      {title && <h3 className="text-lg font-semibold mb-4 text-dark-100">{title}</h3>}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsPieChart>
          <Pie
            data={data}
            cx="50%"
            cy="45%"
            labelLine={false}
            outerRadius="70%"
            innerRadius="42%"
            paddingAngle={4}
            fill="#8884d8"
            dataKey={valueKey}
            nameKey={nameKey}
            label={renderLabel}
          >
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
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
            formatter={(value: number, _name: string, props: any) => {
              const fullName = props.payload?.[nameKey] || _name;
              return [formatter(value), fullName];
            }}
          />
          <Legend content={renderLegend} />
        </RechartsPieChart>
      </ResponsiveContainer>
    </div>
  );
}
