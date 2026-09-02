/**
 * Row-level ownership helpers for `kunde` users.
 *
 * Controllers stay thin: they resolve the effective `kundenr` and let
 * repositories enforce scoping in SQL. These helpers cover the cases
 * where the check must happen in JS (e.g. mismatched body fields).
 *
 * @module http/ownership
 */
import { ForbiddenError, ValidationError } from '../middleware/errorHandler.js';

export interface OwnershipUser {
  role: string;
  kundenr?: string;
  username?: string;
}

/**
 * Resolve which customer number an order operation acts on.
 * Kunde users always act as themselves; admins must supply one explicitly.
 * Throws ValidationError on missing data, ForbiddenError on mismatch.
 */
export function resolveOrderKundenr(
  user: OwnershipUser | undefined,
  bodyKundenr?: string,
): string {
  if (user?.role === 'kunde') {
    if (!user.kundenr) throw new ValidationError('Brukeren mangler kundenummer');
    if (bodyKundenr && bodyKundenr !== user.kundenr) {
      throw new ForbiddenError('Access denied');
    }
    return user.kundenr;
  }
  if (!bodyKundenr) throw new ValidationError('kundenr er påkrevd for administratorbestillinger');
  return bodyKundenr;
}

/** Throw ForbiddenError when a kunde user touches another customer's order. */
export function assertOwnsOrder(
  user: OwnershipUser | undefined,
  orderKundenr: string,
): void {
  if (user?.role !== 'kunde') return;
  if (!user.kundenr || user.kundenr !== orderKundenr) {
    throw new ForbiddenError('Access denied');
  }
}
