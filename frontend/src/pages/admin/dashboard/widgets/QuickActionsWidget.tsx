import { Link } from 'react-router-dom';

const quickActions = [
  { label: 'Prisadministrasjon', path: '/admin/pricing', icon: '💰', color: 'from-primary-600 to-primary-400' },
  { label: 'ETL / Dataimport', path: '/admin/etl', icon: '📦', color: 'from-green-600 to-green-400' },
  { label: 'Ordrelinjer', path: '/admin/orderlines', icon: '📋', color: 'from-purple-600 to-purple-400' },
  { label: 'Systemstatus', path: '/admin/status', icon: '⚙️', color: 'from-amber-600 to-amber-400' },
];

export function QuickActionsWidget() {
  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4">⚡ Hurtighandlinger</h3>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action) => (
          <Link
            key={action.path}
            to={action.path}
            className={`
              p-4 rounded-lg bg-gradient-to-br ${action.color}
              hover:scale-105 active:scale-95 transition-transform
              flex flex-col items-center justify-center text-center
              text-white shadow-lg hover:shadow-xl
            `}
          >
            <span className="text-2xl mb-1">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
