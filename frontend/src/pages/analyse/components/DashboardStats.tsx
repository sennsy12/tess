interface DashboardStatsProps {
  summary: any;
  currencyFormatter: (value: number) => string;
}

export function DashboardStats({ summary, currencyFormatter }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="stat-card gradient-primary text-white">
        <span className="stat-label text-white/80">Totale Ordrer</span>
        <span className="stat-value">{summary?.totalOrders || 0}</span>
      </div>
      <div className="stat-card gradient-success text-white">
        <span className="stat-label text-white/80">Total Omsetning</span>
        <span className="stat-value text-2xl">
          {currencyFormatter(summary?.totalRevenue || 0)}
        </span>
      </div>
      <div className="stat-card gradient-warning text-white">
        <span className="stat-label text-white/80">Aktive Kunder</span>
        <span className="stat-value">{summary?.activeCustomers || 0}</span>
      </div>
      <div className="stat-card gradient-danger text-white">
        <span className="stat-label text-white/80">Produkter Solgt</span>
        <span className="stat-value">{summary?.productsOrdered || 0}</span>
      </div>
    </div>
  );
}
