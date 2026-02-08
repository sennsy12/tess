import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IdleTimer } from './IdleTimer';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

const kundeNavItems = [
  { path: '/kunde', label: 'Dashboard', icon: '📊' },
  { path: '/kunde/orders', label: 'Ordrer', icon: '📋' },
  { path: '/kunde/analytics', label: 'Avansert Analyse', icon: '📈' },
];

const analyseNavItems = [
  { path: '/analyse', label: 'Dashboard', icon: '📊' },
  { path: '/analyse/statistics', label: 'Statistikk', icon: '📈' },
];

const adminNavItems = [
  { path: '/admin', label: 'Dashboard', icon: '📊' },
  { path: '/admin/statistics', label: 'Statistikk', icon: '📈' },
  { path: '/admin/orders', label: 'Ordrer', icon: '📋' },
  { path: '/admin/analytics', label: 'Avansert Analyse', icon: '🔬' },
  { path: '/admin/orderlines', label: 'Ordrelinjer', icon: '📝' },
  { path: '/admin/pricing', label: 'Prisstyring', icon: '💰' },
  { path: '/admin/users', label: 'Brukere', icon: '👤' },
  { path: '/admin/status', label: 'Status', icon: '⚙️' },
  { path: '/admin/etl', label: 'ETL / Data', icon: '🔧' },
];

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getNavItems = () => {
    if (user?.role === 'admin') {
      return adminNavItems;
    }
    if (user?.role === 'analyse') {
      return analyseNavItems;
    }
    return kundeNavItems;
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Mobile Header */}
      <header className="lg:hidden bg-dark-900 border-b border-dark-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-primary-400">TESS</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-dark-300 hover:text-white"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </header>

      {/* Sidebar Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 w-64 bg-dark-900 border-r border-dark-800 flex flex-col z-50 transition-transform duration-300 transform
        lg:translate-x-0 lg:static lg:inset-auto
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-dark-800 hidden lg:block">
          <h1 className="text-xl font-bold text-primary-400">TESS</h1>
          <p className="text-sm text-dark-400">Sales Order System</p>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-dark-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white font-medium">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-100 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-dark-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full btn-secondary text-sm"
          >
            Logg ut
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0">
        <header className="hidden lg:block bg-dark-900/50 backdrop-blur-sm border-b border-dark-800 sticky top-0 z-10">
          <div className="px-8 py-4">
            <h2 className="text-2xl font-semibold text-dark-50">{title}</h2>
          </div>
        </header>
        <div className="p-4 lg:p-8 animate-fade-in">
          {/* Mobile Title (only visible on mobile) */}
          <h2 className="text-xl font-semibold text-dark-50 mb-6 lg:hidden">{title}</h2>
          {children}
        </div>
      </main>

      {/* Idle timer for automatic logout */}
      <IdleTimer />
    </div>
  );
}
