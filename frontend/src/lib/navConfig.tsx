import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  BarChart3,
  ClipboardList,
  FlaskConical,
  ListOrdered,
  CircleDollarSign,
  Building2,
  Package,
  Users,
  Activity,
  Database,
  ScrollText,
  LineChart,
  UserCircle,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  Icon: LucideIcon;
}

export const kundeNavItems: NavItem[] = [
  { path: '/kunde', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/kunde/konto', label: 'Min konto', Icon: UserCircle },
  { path: '/kunde/orders', label: 'Ordrer', Icon: ClipboardList },
  { path: '/kunde/pricing', label: 'Mine priser', Icon: CircleDollarSign },
  { path: '/kunde/statistics', label: 'Statistikk', Icon: BarChart3 },
  { path: '/kunde/analytics', label: 'Avansert Analyse', Icon: LineChart },
];

export const analyseNavItems: NavItem[] = [
  { path: '/analyse', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/analyse/statistics', label: 'Statistikk', Icon: BarChart3 },
];

export const adminNavItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard', Icon: LayoutDashboard },
  { path: '/admin/statistics', label: 'Statistikk', Icon: BarChart3 },
  { path: '/admin/orders', label: 'Ordrer', Icon: ClipboardList },
  { path: '/admin/analytics', label: 'Avansert Analyse', Icon: FlaskConical },
  { path: '/admin/orderlines', label: 'Ordrelinjer', Icon: ListOrdered },
  { path: '/admin/pricing', label: 'Prisstyring', Icon: CircleDollarSign },
  { path: '/admin/customers', label: 'Kunder', Icon: Building2 },
  { path: '/admin/products', label: 'Produkter', Icon: Package },
  { path: '/admin/users', label: 'Brukere', Icon: Users },
  { path: '/admin/status', label: 'Status', Icon: Activity },
  { path: '/admin/etl', label: 'ETL / Data', Icon: Database },
  { path: '/admin/audit', label: 'Endringslogg', Icon: ScrollText },
];

/** Longest matching nav path wins (nested routes stay highlighted). */
export function isNavItemActive(pathname: string, itemPath: string, allPaths: string[]): boolean {
  if (!pathname.startsWith(itemPath)) return false;
  const matches = allPaths.filter((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (matches.length === 0) return pathname === itemPath;
  const longest = matches.reduce((a, b) => (a.length >= b.length ? a : b));
  return longest === itemPath;
}
