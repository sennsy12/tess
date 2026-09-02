import { ReactNode, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Menu, X as XIcon, LogOut, HelpCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { IdleTimer } from './IdleTimer';
import { EnvironmentBanner } from './EnvironmentBanner';
import { ImpersonationBanner } from './ImpersonationBanner';
import { GlobalSearch } from './GlobalSearch';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { AssistantChat } from './assistant';
import { NotificationBell } from './NotificationBell';
import { useEtlJobToasts } from '../hooks/useEtlJobToasts';
import { KundeMobileNav, AnalyseMobileNav } from './KundeMobileNav';
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

export function Layout({ children, title }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement>(null);
  const isFirstRouteRender = useRef(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [searchOpen, setSearchOpen] = useState(false);

  useDocumentTitle(title);

  useEffect(() => {
    if (isFirstRouteRender.current) {
      isFirstRouteRender.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [location.pathname]);

  // Phase 0: keyboard-dismissable mobile drawer (additive, no visual change).
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobileMenuOpen]);

  const isAdminOnKundeRoute =
    user?.role === 'admin' && location.pathname.startsWith('/kunde');
  const showKundeMobileNav =
    (user?.role === 'kunde' || isAdminOnKundeRoute) && !location.pathname.includes('/login');
  // Analyse has only 2 entries — they fit the same bottom-bar pattern.
  // Admin on its own routes intentionally stays drawer-only.
  const showAnalyseMobileNav =
    user?.role === 'analyse' && !location.pathname.includes('/login');
  const showBottomNav = showKundeMobileNav || showAnalyseMobileNav;

  const { open: onboardingOpen, dismiss: dismissOnboarding } = useKundeOnboarding();

  const showGlobalSearch =
    user?.role === 'admin' || user?.role === 'kunde';

  useKeyboardShortcut('ctrl+k', () => setSearchOpen(true), { enabled: showGlobalSearch });
  useKeyboardShortcut('meta+k', () => setSearchOpen(true), { enabled: showGlobalSearch });

  const showNotifications = user?.role === 'admin' || user?.role === 'kunde';
  const showEtlToasts = user?.role === 'admin' && !isAdminOnKundeRoute;
  useEtlJobToasts(showEtlToasts);

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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:border focus:border-gold-500/40 focus:bg-dark-900 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Hopp til innhold
      </a>
      <header className="lg:hidden bg-dark-900 border-b border-dark-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-dark-950 border border-gold-500/40 flex items-center justify-center">
            <span className="font-display text-base font-light text-gold-400">T</span>
          </div>
          <h1 className="text-base font-semibold text-white tracking-[0.18em] uppercase">Tess</h1>
        </div>
        <div className="flex items-center gap-1">
          {showGlobalSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="p-2 rounded-lg text-dark-300 hover:text-white hover:bg-dark-800 transition-colors"
              aria-label="Søk (Ctrl+K)"
            >
              <Search className="h-5 w-5" aria-hidden />
            </button>
          )}
          {showNotifications && <NotificationBell />}
          <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-dark-300 hover:text-white transition-colors"
          aria-label={isMobileMenuOpen ? 'Lukk meny' : 'Åpne meny'}
          aria-expanded={isMobileMenuOpen}
          aria-controls="app-sidebar"
        >
          {isMobileMenuOpen ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          role="presentation"
        />
      )}

      <aside
        id="app-sidebar"
        className={`
        fixed inset-y-0 left-0 bg-dark-900 border-r border-dark-800 flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]
        lg:translate-x-0 lg:static lg:inset-auto shadow-2xl lg:shadow-none
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        ${isSidebarCollapsed ? 'w-[80px]' : 'w-72'}
      `}
      >
        <div className={`h-20 flex items-center border-b border-dark-800 ${isSidebarCollapsed ? 'justify-center' : 'justify-between px-6'}`}>
          <div className={`overflow-hidden transition-all duration-300 flex items-center gap-3 ${isSidebarCollapsed ? 'w-0 opacity-0 absolute' : 'w-auto opacity-100'}`}>
            <div className="w-9 h-9 rounded-md bg-dark-950 border border-gold-500/40 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="font-display text-lg font-light text-gold-400">T</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-[0.18em] uppercase">Tess</h1>
              <p className="text-[10px] text-gold-500/90 font-medium uppercase tracking-[0.22em]">Analytics Platform</p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleSidebar}
            className={`p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-all duration-200 ${isSidebarCollapsed ? 'mx-auto' : ''}`}
            aria-label={isSidebarCollapsed ? 'Utvid sidemeny' : 'Skjul sidemeny'}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-5 w-5" aria-hidden /> : <ChevronLeft className="h-5 w-5" aria-hidden />}
          </button>
        </div>

        <nav className={`flex-1 overflow-y-auto overflow-x-hidden space-y-1 py-6 ${isSidebarCollapsed ? 'px-3' : 'px-4'}`} aria-label="Hovedmeny">
          {navItems.map((item) => {
            const active = isNavItemActive(location.pathname, item.path, navPaths);
            const Icon = item.Icon;
            const Badge = item.Badge;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                onMouseEnter={() => prefetchRoute(queryClient, item.path)}
                onFocus={() => prefetchRoute(queryClient, item.path)}
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
                {Badge && <Badge collapsed={isSidebarCollapsed} />}
                {isSidebarCollapsed && (
                  <div aria-hidden="true" className="absolute left-full ml-4 px-3 py-2 rounded-lg text-sm font-medium bg-dark-800 text-white border border-dark-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none z-[100] whitespace-nowrap shadow-xl">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        <div className={`border-t border-dark-800 bg-dark-900 ${isSidebarCollapsed ? 'p-3' : 'p-5'}`}>
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
              {showGlobalSearch && (
                <button type="button" onClick={() => setSearchOpen(true)} className="w-full btn-secondary text-sm py-2 flex items-center justify-center gap-2">
                  <Search className="h-4 w-4" aria-hidden />
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

      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className={`flex-1 overflow-auto min-w-0 h-screen supports-[height:100dvh]:h-[100dvh] relative scroll-smooth focus:outline-none ${showBottomNav ? 'pb-16 lg:pb-0' : ''}`}
      >
        <EnvironmentBanner />
        <header className="hidden lg:block bg-dark-950/90 backdrop-blur-sm border-b border-gold-500/15 sticky top-0 z-10">
          <div className="px-8 py-5 flex items-center justify-between">
            <h2 className="text-xl font-light font-display text-white tracking-wide">{title}</h2>
            <div className="flex items-center gap-2">
              {showGlobalSearch && (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="hidden sm:flex items-center gap-2 rounded-md border border-dark-700 bg-dark-900 px-3 py-1.5 text-sm text-dark-400 hover:text-dark-200 hover:border-dark-600 transition-colors"
                  aria-label="Søk (Ctrl+K)"
                >
                  <Search className="h-4 w-4" aria-hidden />
                  <span>Søk</span>
                  <kbd className="hidden md:inline text-[10px] font-mono text-dark-500 bg-dark-800 px-1.5 py-0.5 rounded">Ctrl+K</kbd>
                </button>
              )}
              {showNotifications && <NotificationBell />}
              <div className="text-[11px] text-dark-500 uppercase tracking-wider">
                Oppdatert {new Date().toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 animate-fade-in">
          <h2 className="text-2xl font-bold text-white mb-6 lg:hidden">{title}</h2>
          {isAdminOnKundeRoute && <ImpersonationBanner />}
          {children}
        </div>
      </main>

      {showKundeMobileNav && <KundeMobileNav />}
      {showAnalyseMobileNav && <AnalyseMobileNav />}
      {user?.role === 'kunde' && (
        <KundeOnboardingModal open={onboardingOpen} onDismiss={dismissOnboarding} />
      )}

      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <AssistantChat elevatedBottom={showBottomNav} />
      <IdleTimer />
    </div>
  );
}
