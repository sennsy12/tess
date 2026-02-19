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
    <div className="min-h-screen flex flex-col lg:flex-row bg-dark-950">
      {/* Mobile Header */}
      <header className="lg:hidden bg-dark-900/80 backdrop-blur-md border-b border-dark-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">T</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-dark-400">TESS</h1>
        </div>
        <button 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-dark-300 hover:text-white transition-colors"
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
        fixed inset-y-0 left-0 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        lg:translate-x-0 lg:static lg:inset-auto shadow-2xl lg:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'w-[80px]' : 'w-72'}
      `}>
        {/* Header with toggle */}
        <div className={`h-20 flex items-center border-b border-dark-800/50 ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-6'}`}>
          <div className={`overflow-hidden transition-all duration-300 flex items-center gap-3 ${isSidebarCollapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100'}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">T</div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">TESS</h1>
              <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider">Analytics Platform</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className={`p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all duration-200 ${isSidebarCollapsed ? 'mx-auto' : ''}`}
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Mobile header inside sidebar */}
        <div className="p-6 border-b border-dark-800 lg:hidden">
          <h1 className="text-xl font-bold text-white">TESS</h1>
          <p className="text-sm text-dark-400">Sales Order System</p>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-1 py-6 ${isSidebarCollapsed ? 'px-3' : 'px-4'}`}>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setIsMobileMenuOpen(false)}
              className={`
                nav-link group relative
                ${location.pathname === item.path ? 'active' : ''}
                ${isSidebarCollapsed ? 'justify-center px-0 py-3' : ''}
              `}
              title={isSidebarCollapsed ? item.label : undefined}
            >
              <span className={`flex-shrink-0 transition-transform duration-300 group-hover:scale-110 ${isSidebarCollapsed ? 'text-2xl' : 'text-xl'}`}>{item.icon}</span>
              <span className={`transition-all duration-300 whitespace-nowrap font-medium ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden absolute' : 'w-auto opacity-100'}`}>
                {item.label}
              </span>
              
              {/* Tooltip on hover when collapsed */}
              {isSidebarCollapsed && (
                <div className="
                  absolute left-full ml-4 px-3 py-2 rounded-lg text-sm font-medium
                  bg-dark-800 text-white border border-dark-700
                  opacity-0 invisible group-hover:opacity-100 group-hover:visible
                  transition-all duration-200 pointer-events-none z-[100]
                  whitespace-nowrap shadow-xl shadow-black/40
                  translate-x-[-10px] group-hover:translate-x-0
                ">
                  {item.label}
                  {/* Triangle for tooltip */}
                  <div className="absolute top-1/2 -left-1.5 -mt-1 border-4 border-transparent border-r-dark-800"></div>
                </div>
              )}
            </Link>
          ))}
        </nav>

        {/* User profile section */}
        <div className={`border-t border-dark-800/50 bg-dark-900/50 ${isSidebarCollapsed ? 'p-3' : 'p-5'}`}>
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center mb-0' : 'gap-4 mb-4'}`}>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-dark-700 to-dark-800 border border-dark-600 flex items-center justify-center flex-shrink-0 group relative shadow-inner">
              <span className="text-white font-semibold text-lg">
                {user?.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className={`min-w-0 transition-all duration-300 ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden absolute' : 'flex-1 opacity-100'}`}>
              <p className="text-sm font-medium text-white truncate">
                {user?.username}
              </p>
              <p className="text-xs text-dark-400 capitalize flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {user?.role}
              </p>
            </div>
          </div>
          
          {!isSidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2 group hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400 transition-all duration-300"
            >
              <LogoutIcon />
              <span className="font-medium">Logg ut</span>
            </button>
          )}
          
          {isSidebarCollapsed && (
            <button
              onClick={handleLogout}
              className="w-10 h-10 mx-auto mt-2 flex items-center justify-center rounded-lg text-dark-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
              title="Logg ut"
            >
              <LogoutIcon />
            </button>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto min-w-0 h-screen relative scroll-smooth">
        <header className="hidden lg:block bg-dark-950/80 backdrop-blur-md border-b border-dark-800/50 sticky top-0 z-10 transition-all duration-300">
          <div className="px-8 py-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-dark-400 tracking-tight">{title}</h2>
            <div className="flex items-center gap-4">
              <div className="text-xs text-dark-400 font-mono bg-dark-900 border border-dark-800 px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 lg:p-8 animate-in-up">
          {/* Mobile Title */}
          <h2 className="text-2xl font-bold text-white mb-6 lg:hidden">{title}</h2>
          {children}
        </div>
      </main>

      {/* Idle timer for automatic logout */}
      <IdleTimer />
    </div>
  );
}
