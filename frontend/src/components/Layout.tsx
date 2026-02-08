import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IdleTimer } from './IdleTimer';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

// SVG icons for the toggle button
const ChevronLeftIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 18l-6-6 6-6" />
  </svg>
);

const ChevronRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18l6-6-6-6" />
  </svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

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
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
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
        fixed inset-y-0 left-0 bg-dark-900 border-r border-dark-800 flex flex-col z-50 transition-all duration-300 transform
        lg:translate-x-0 lg:static lg:inset-auto
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'w-[72px]' : 'w-64'}
      `}>
        {/* Header with toggle */}
        <div className={`border-b border-dark-800 hidden lg:flex items-center ${isSidebarCollapsed ? 'justify-center p-4' : 'justify-between p-6'}`}>
          <div className={`overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
            <h1 className="text-xl font-bold text-primary-400 whitespace-nowrap">TESS</h1>
            <p className="text-sm text-dark-400 whitespace-nowrap">Sales Order System</p>
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-800 transition-colors flex-shrink-0"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Mobile header inside sidebar */}
        <div className="p-6 border-b border-dark-800 lg:hidden">
          <h1 className="text-xl font-bold text-primary-400">TESS</h1>
          <p className="text-sm text-dark-400">Sales Order System</p>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 space-y-1 overflow-y-auto overflow-x-hidden ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`
                nav-link group relative
                ${location.pathname === item.path ? 'active' : ''}
                ${isSidebarCollapsed ? 'justify-center px-0 py-2.5' : ''}
              `}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 ${isSidebarCollapsed ? 'text-xl' : 'text-lg'}`}>{item.icon}</span>
              <span className={`transition-all duration-300 whitespace-nowrap ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'w-auto opacity-100'}`}>
                {item.label}
              </span>
              {/* Tooltip on hover when collapsed */}
              {isSidebarCollapsed && (
                <span className="
                  absolute left-full ml-2 px-3 py-1.5 rounded-lg text-sm font-medium
                  bg-dark-800 text-dark-100 border border-dark-700
                  opacity-0 invisible group-hover:opacity-100 group-hover:visible
                  transition-all duration-200 pointer-events-none z-[100]
                  whitespace-nowrap shadow-lg shadow-black/20
                ">
                  {item.label}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* User profile section */}
        <div className={`border-t border-dark-800 ${isSidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center mb-2' : 'gap-3 mb-4'}`}>
            <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center flex-shrink-0 group relative">
              <span className="text-white font-medium">
                {user?.username.charAt(0).toUpperCase()}
              </span>
              {/* Tooltip for avatar when collapsed */}
              {isSidebarCollapsed && (
                <span className="
                  absolute left-full ml-2 px-3 py-1.5 rounded-lg text-sm font-medium
                  bg-dark-800 text-dark-100 border border-dark-700
                  opacity-0 invisible group-hover:opacity-100 group-hover:visible
                  transition-all duration-200 pointer-events-none z-[100]
                  whitespace-nowrap shadow-lg shadow-black/20
                ">
                  {user?.username} ({user?.role})
                </span>
              )}
            </div>
            <div className={`min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden' : 'flex-1 opacity-100'}`}>
              <p className="text-sm font-medium text-dark-100 truncate">
                {user?.username}
              </p>
              <p className="text-xs text-dark-400 capitalize">{user?.role}</p>
            </div>
          </div>
          {isSidebarCollapsed ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center p-2 rounded-lg text-dark-400 hover:text-red-400 hover:bg-dark-800 transition-colors group relative"
              title="Logg ut"
            >
              <LogoutIcon />
              <span className="
                absolute left-full ml-2 px-3 py-1.5 rounded-lg text-sm font-medium
                bg-dark-800 text-dark-100 border border-dark-700
                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                transition-all duration-200 pointer-events-none z-[100]
                whitespace-nowrap shadow-lg shadow-black/20
              ">
                Logg ut
              </span>
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full btn-secondary text-sm"
            >
              Logg ut
            </button>
          )}
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
