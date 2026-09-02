import { StatCard } from '../../../components/StatCard';
import { formatNumberNb } from '../../../lib/formatters';

interface DashboardStatsProps {
  summary: any;
  currencyFormatter: (value: number) => string;
}

export function DashboardStats({ summary, currencyFormatter }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        label="Totale Ordrer"
        value={formatNumberNb(summary?.totalOrders || 0)}
        numericValue={summary?.totalOrders || 0}
        className="gradient-primary text-white"
        labelClassName="text-white/80"
      />
      <StatCard
        label="Total Omsetning"
        value={currencyFormatter(summary?.totalRevenue || 0)}
        numericValue={summary?.totalRevenue || 0}
        format={currencyFormatter}
        className="gradient-success text-white"
        labelClassName="text-white/80"
      />
      <StatCard
        label="Aktive Kunder"
        value={formatNumberNb(summary?.activeCustomers || 0)}
        numericValue={summary?.activeCustomers || 0}
        className="gradient-warning text-white"
        labelClassName="text-white/80"
      />
      <StatCard
        label="Produkter Solgt"
        value={formatNumberNb(summary?.productsOrdered || 0)}
        numericValue={summary?.productsOrdered || 0}
        className="gradient-danger text-white"
        labelClassName="text-white/80"
      />
    </div>
  );
}
