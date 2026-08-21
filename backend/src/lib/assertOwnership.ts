import { ForbiddenError } from '../middleware/errorHandler.js';

type AuthUser = {
  role: 'admin' | 'kunde' | 'analyse';
  kundenr?: string;
};

/** Ensures a kunde user can only access their own customer number. */
export function assertKundeOwnership(user: AuthUser | undefined, kundenr: string): void {
  if (user?.role !== 'kunde') return;

  if (!user.kundenr || user.kundenr !== kundenr) {
    throw new ForbiddenError('Access denied');
  }
}
