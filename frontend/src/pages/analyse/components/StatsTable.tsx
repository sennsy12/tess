interface StatsTableProps {
  data: any[];
  nameKey: string;
  title: string;
  currencyFormatter: (value: number) => string;
}

export function StatsTable({ data, nameKey, title, currencyFormatter }: StatsTableProps) {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">Detaljerte tall</h3>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">{title.replace('Statistikk per ', '')}</th>
              <th className="table-header text-right">Antall Ordrer</th>
              <th className="table-header text-right">Total Sum</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-dark-800/30 transition-colors">
                <td className="table-cell font-medium">{item[nameKey] || '-'}</td>
                <td className="table-cell text-right">{item.order_count || 0}</td>
                <td className="table-cell text-right font-semibold text-primary-400">
                  {currencyFormatter(item.total_sum || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
