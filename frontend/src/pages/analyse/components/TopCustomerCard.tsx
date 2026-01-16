interface TopCustomerCardProps {
  topCustomer: any;
  currencyFormatter: (value: number) => string;
}

export function TopCustomerCard({ topCustomer, currencyFormatter }: TopCustomerCardProps) {
  if (!topCustomer) return null;

  return (
    <div className="card bg-gradient-to-r from-primary-600/20 to-purple-600/20 border-primary-700/50">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-dark-400">🏆 Beste Kunde</span>
          <h3 className="text-xl font-bold">{topCustomer.kundenavn}</h3>
        </div>
        <div className="text-right">
          <span className="text-sm text-dark-400">Total omsetning</span>
          <p className="text-2xl font-bold text-green-400">
            {currencyFormatter(topCustomer.total)}
          </p>
        </div>
      </div>
    </div>
  );
}
