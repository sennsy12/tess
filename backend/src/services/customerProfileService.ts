import type { AuthRequest } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../middleware/errorHandler.js';
import { customerModel, type CustomerProfileDbRow } from '../models/customerModel.js';
import type { KundeProfile } from '../types/customer.js';

function mapDbRowToProfile(row: CustomerProfileDbRow): KundeProfile {
  const contactRefs = Array.isArray(row.contact_refs_json)
    ? row.contact_refs_json.filter((ref): ref is string => typeof ref === 'string')
    : [];

  return {
    kundenr: row.kundenr,
    kundenavn: row.kundenavn ?? null,
    customer_group_id: row.customer_group_id ?? null,
    customer_group_name: row.customer_group_name ?? null,
    customer_group_description: row.customer_group_description ?? null,
    portal_username: row.portal_username ?? null,
    account_created_at: row.account_created_at ?? null,
    primary_firma: row.primary_firma ?? null,
    primary_lager: row.primary_lager ?? null,
    contact_refs: contactRefs,
    stats: {
      order_count: row.order_count ?? 0,
      total_revenue: row.total_revenue ?? 0,
      active_orders: row.active_orders ?? 0,
      first_order_date: row.first_order_date ?? null,
      last_order_date: row.last_order_date ?? null,
    },
  };
}

export const customerProfileService = {
  /**
   * Load a full kunde portal profile by customer number.
   */
  getByKundenr: async (kundenr: string): Promise<KundeProfile> => {
    const row = await customerModel.findProfileByNumber(kundenr);
    if (!row) {
      throw new NotFoundError('Customer not found');
    }
    return mapDbRowToProfile(row);
  },

  /**
   * Resolve profile for the authenticated portal user (JWT kundenr only — no URL override).
   */
  getForAuthenticatedUser: async (user: AuthRequest['user']): Promise<KundeProfile> => {
    if (!user?.kundenr) {
      throw new ForbiddenError('No customer account linked to this user');
    }
    return customerProfileService.getByKundenr(user.kundenr);
  },
};
