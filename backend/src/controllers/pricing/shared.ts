import { AuthRequest } from '../../middleware/auth.js';

/** Helper to extract audit user from request */
export function getAuditUser(req: AuthRequest) {
  return { id: req.user?.id, username: req.user?.username || 'unknown' };
}
