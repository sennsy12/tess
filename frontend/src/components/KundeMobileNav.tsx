import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, X } from 'lucide-react';
import {
  analyseNavItems,
  isNavItemActive,
  kundeMobileItems,
  kundeNavItems,
  type NavItem,
} from '../lib/navConfig';

/**
 * Phase 1 — unified bottom-bar navigation.
 *
 * Tabs render from the shared `navConfig` source (`shortLabel` for compact
 * wording), so sidebar and bottom bar can no longer drift in order/labels.
 * Badges (e.g. cart count) render on the tab icon, and sidebar-only entries
 * (`Mine priser`, `Avansert Analyse`) are reachable through the "Mer" sheet.
 * Admin on its own routes intentionally stays drawer-only.
 */

// Sidebar entries with no dedicated tab — exposed via the "Mer" sheet.
const kundeOverflowItems: NavItem[] = kundeNavItems.filter(
  (item) => !kundeMobileItems.some((tab) => tab.path === item.path),
);

const kundeAllPaths = kundeNavItems.map((i) => i.path);
const analysePaths = analyseNavItems.map((i) => i.path);

interface BottomTabProps {
  item: NavItem;
  active: boolean;
}

function BottomTab({ item, active }: BottomTabProps) {
  const { path, Icon, Badge } = item;
  const label = item.shortLabel ?? item.label;
  return (
    <Link
      to={path}
      className={`relative flex flex-col items-center justify-center gap-0.5 h-full text-xs font-medium transition-colors ${
        active ? 'text-primary-400' : 'text-dark-400 hover:text-dark-200'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      <span className="relative inline-flex">
        <Icon className="h-5 w-5" aria-hidden />
        {Badge && <Badge collapsed badgeClassName="-top-2 -right-3" />}
      </span>
      <span>{label}</span>
    </Link>
  );
}

interface BottomBarProps {
  items: NavItem[];
  allPaths: string[];
  overflowItems?: NavItem[];
  ariaLabel: string;
}

function MobileBottomBar({ items, allPaths, overflowItems = [], ariaLabel }: BottomBarProps) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMoreOpen = useRef(false);

  const overflowActive = overflowItems.some((item) =>
    isNavItemActive(location.pathname, item.path, allPaths),
  );

  // Close on Escape + restore focus to the "Mer" button.
  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  useEffect(() => {
    if (moreOpen) {
      wasMoreOpen.current = true;
      closeButtonRef.current?.focus();
    } else if (wasMoreOpen.current) {
      // Return focus only after the sheet was actually open (not on mount).
      wasMoreOpen.current = false;
      moreButtonRef.current?.focus();
    }
  }, [moreOpen]);

  const showMore = overflowItems.length > 0;

  return (
    <>
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-dark-800 bg-dark-900/95 backdrop-blur-md safe-area-pb"
        aria-label={ariaLabel}
      >
        <ul className="flex justify-around items-stretch h-16">
          {items.map((item) => {
            const active = isNavItemActive(location.pathname, item.path, allPaths);
            return (
              <li key={item.path} className="flex-1">
                <BottomTab item={item} active={active} />
              </li>
            );
          })}
          {showMore && (
            <li className="flex-1">
              <button
                ref={moreButtonRef}
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-expanded={moreOpen}
                aria-controls="mobile-more-sheet"
                className={`flex flex-col items-center justify-center gap-0.5 h-full w-full text-xs font-medium transition-colors ${
                  overflowActive ? 'text-primary-400' : 'text-dark-400 hover:text-dark-200'
                }`}
              >
                <MoreHorizontal className="h-5 w-5" aria-hidden />
                <span>Mer</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      {showMore && (
        <AnimatePresence>
          {moreOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
                onClick={() => setMoreOpen(false)}
                role="presentation"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-50 lg:hidden rounded-t-2xl bg-dark-900 border-t border-dark-700 safe-area-pb"
                role="dialog"
                aria-modal="true"
                aria-label="Flere sider"
                id="mobile-more-sheet"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-800">
                  <h2 className="text-sm font-semibold text-white">Mer</h2>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    onClick={() => setMoreOpen(false)}
                    className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800 transition-colors"
                    aria-label="Lukk meny"
                  >
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                </div>
                <ul className="p-2">
                  {overflowItems.map((item) => {
                    const active = isNavItemActive(location.pathname, item.path, allPaths);
                    const Icon = item.Icon;
                    return (
                      <li key={item.path}>
                        <Link
                          to={item.path}
                          onClick={() => setMoreOpen(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                            active
                              ? 'text-primary-400 bg-primary-500/10'
                              : 'text-dark-200 hover:text-white hover:bg-dark-800'
                          }`}
                        >
                          <Icon className="h-5 w-5 flex-shrink-0" aria-hidden />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      )}
    </>
  );
}

export function KundeMobileNav() {
  return (
    <MobileBottomBar
      items={kundeMobileItems}
      allPaths={kundeAllPaths}
      overflowItems={kundeOverflowItems}
      ariaLabel="Hovednavigasjon"
    />
  );
}

export function AnalyseMobileNav() {
  return (
    <MobileBottomBar
      items={analyseNavItems}
      allPaths={analysePaths}
      ariaLabel="Hovednavigasjon"
    />
  );
}
