import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, BarChart3, UserCircle } from 'lucide-react';
import { isNavItemActive } from '../lib/navConfig';

const items = [
  { path: '/kunde', label: 'Hjem', Icon: LayoutDashboard },
  { path: '/kunde/orders', label: 'Ordrer', Icon: ClipboardList },
  { path: '/kunde/statistics', label: 'Statistikk', Icon: BarChart3 },
  { path: '/kunde/konto', label: 'Konto', Icon: UserCircle },
];

const paths = items.map((i) => i.path);

export function KundeMobileNav() {
  const location = useLocation();

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-dark-800 bg-dark-900/95 backdrop-blur-md safe-area-pb"
      aria-label="Hovednavigasjon"
    >
      <ul className="flex justify-around items-stretch h-16">
        {items.map(({ path, label, Icon }) => {
          const active = isNavItemActive(location.pathname, path, paths);
          return (
            <li key={path} className="flex-1">
              <Link
                to={path}
                className={`flex flex-col items-center justify-center gap-0.5 h-full text-xs font-medium transition-colors ${
                  active ? 'text-primary-400' : 'text-dark-400 hover:text-dark-200'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
