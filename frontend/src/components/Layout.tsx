import { ReactNode, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, X as XIcon, LogOut, HelpCircle } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { IdleTimer } from './IdleTimer';
import { EnvironmentBanner } from './EnvironmentBanner';
import { ImpersonationBanner } from './ImpersonationBanner';
import { GlobalSearch, useGlobalSearchShortcut } from './GlobalSearch';
import { KundeMobileNav } from './KundeMobileNav';
import { KundeOnboardingModal, useKundeOnboarding } from './KundeOnboarding';
import {
  adminNavItems,
  analyseNavItems,
  kundeNavItems,
  isNavItemActive,
  type NavItem,
} from '../lib/navConfig';
import { prefetchRoute } from '../lib/prefetch';
import { supportMailto } from '../lib/appConfig';

interface LayoutProps {
  children: ReactNode;
  title: string;
}

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

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [searchOpen, setSearchOpen] = useState(false);

  const isAdminOnKundeRoute =
    user?.role === 'admin' && location.pathname.startsWith('/kunde');
  const showKundeMobileNav =
    (user?.role === 'kunde' || isAdminOnKundeRoute) && !location.pathname.includes('/login');

  const { open: onboardingOpen, dismiss: dismissOnboarding } = useKundeOnboarding();

  useGlobalSearchShortcut(() => setSearchOpen(true), user?.role === 'admin');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    const newState = !isSidebarCollapsed;
    setIsSidebarCollapsed(newState);
    localStorage.setItem('sidebar-collapsed', String(newState));
  };

  const getNavItems = (): NavItem[] => {
    if (isAdminOnKundeRoute) return kundeNavItems;
    if (user?.role === 'admin') return adminNavItems;
    if (user?.role === 'analyse') return analyseNavItems;
    return kundeNavItems;
  };

  const settingsPath =
    user?.role === 'admin'
      ? '/admin/settings'
      : user?.role === 'analyse'
        ? '/analyse/settings'
        : '/kunde/settings';

  const navItems = getNavItems();
  const navPaths = navItems.map((i) => i.path);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-dark-950">
      <header className="lg:hidden bg-dark-900/80 backdrop-blur-md border-b border-dark-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/20">T</div>
          <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-dark-400">TESS</h1>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-dark-300 hover:text-white transition-colors"
          aria-label={isMobileMenuOpen ? 'Lukk meny' : 'Åpne meny'}
        >
          {isMobileMenuOpen ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </header>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          role="presentation"
        />
      )}

      <aside
        className={`
        fixed inset-y-0 left-0 bg-dark-900/95 backdrop-blur-xl border-r border-dark-700/50 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        lg:translate-x-0 lg:static lg:inset-auto shadow-2xl lg:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'w-[80px]' : 'w-72'}
      `}
      >
        <div className={`h-20 flex items-center border-b border-dark-800/50 ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-6'}`}>
          <div className={`overflow-hidden transition-all duration-300 flex items-center gap-3 ${isSidebarCollapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100'}`}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-600 to-primary-500 flex items-center justify-center text-white font-bold shadow-lg shadow-primary-500/20">T</div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">TESS</h1>
              <p className="text-[10px] text-primary-400 font-semibold uppercase tracking-wider">Analytics Platform</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className={`p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all duration-200 ${isSidebarCollapsed ? 'mx-auto' : ''}`}
            aria-label={isSidebarCollapsed ? 'Utvid sidemeny' : 'Skjul sidemeny'}
          >
            {isSidebarCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-1 py-6 ${isSidebarCollapsed ? 'px-3' : 'px-4'}`} aria-label="Hovedmeny">
          {navItems.map((item) => {
            const active = isNavItemActive(location.pathname, item.path, navPaths);
            const Icon = item.Icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                onMouseEnter={() => prefetchRoute(queryClient, item.path)}
                className={`
                  nav-link group relative flex items-center gap-3
                  ${active ? 'active' : ''}
                  ${isSidebarCollapsed ? 'justify-center px-0 py-3' : ''}
                `}
                title={isSidebarCollapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-primary-400' : 'text-dark-400 group-hover:text-dark-200'}`} aria-hidden />
                <span className={`transition-all duration-300 whitespace-nowrap font-medium ${isSidebarCollapsed ? 'w-0 opacity-0 overflow-hidden absolute' : 'w-auto opacity-100'}`}>
                  {item.label}
                </span>
                {isSidebarCollapsed && (
                  <div className="absolute left-full ml-4 px-3 py-2 rounded-lg text-sm font-medium bg-dark-800 text-white border border-dark-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-[100] whitespace-nowrap shadow-xl">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-dark-800/50 bg-dark-900/50 ${isSidebarCollapsed ? 'p-3' : 'p-5'}`}>
          {!isSidebarCollapsed && (
            <div className="space-y-2">
              <a href={supportMailto} className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2">
                <HelpCircle className="h-4 w-4" aria-hidden />
                Hjelp / Kontakt
              </a>
              <Link
                to={settingsPath}
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2"
              >
                Innstillinger
              </Link>
              {user?.role === 'admin' && !isAdminOnKundeRoute && (
                <button type="button" onClick={() => setSearchOpen(true)} className="w-full btn-secondary text-sm py-2">
                  Søk (Ctrl+K)
                </button>
              )}
              <button
                type="button"
                onClick={handleLogout}
                className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2 hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Logg ut
              </button>
            </div>
          )}
          {isSidebarCollapsed && (
            <button
              type="button"
              onClick={handleLogout}
              className="w-10 h-10 mx-auto flex items-center justify-center rounded-lg text-dark-400 hover:text-red-400"
              aria-label="Logg ut"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </aside>

      <main className={`flex-1 overflow-auto min-w-0 h-screen relative scroll-smooth ${showKundeMobileNav ? 'pb-16 lg:pb-0' : ''}`}>
        <EnvironmentBanner />
        <header className="hidden lg:block bg-dark-950/80 backdrop-blur-md border-b border-dark-800/50 sticky top-0 z-10">
          <div className="px-8 py-5 flex items-center justify-between">
            <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-dark-400 tracking-tight">{title}</h2>
            <div className="text-xs text-dark-500 font-mono">
              Oppdatert {new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </header>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="p-4 lg:p-8"
          >
            <h2 className="text-2xl font-bold text-white mb-6 lg:hidden">{title}</h2>
            {isAdminOnKundeRoute && <ImpersonationBanner />}
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {showKundeMobileNav && <KundeMobileNav />}
      {user?.role === 'kunde' && (
        <KundeOnboardingModal open={onboardingOpen} onDismiss={dismissOnboarding} />
      )}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <IdleTimer />
    </div>
  );
}
