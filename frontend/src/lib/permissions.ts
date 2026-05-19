import type { User } from '../context/authTypes';

export type Permission =
  | 'etl.destructive'
  | 'users.manage'
  | 'pricing.manage'
  | 'orders.read'
  | 'reports.shared';

const ROLE_PERMISSIONS: Record<User['role'], Permission[]> = {
  admin: [
    'etl.destructive',
    'users.manage',
    'pricing.manage',
    'orders.read',
    'reports.shared',
  ],
  analyse: ['orders.read', 'reports.shared'],
  kunde: ['orders.read'],
};

export function hasPermission(user: User | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role]?.includes(permission) ?? false;
}
