/**
 * Customer Model (facade).
 *
 * Implementation lives in `repositories/customer/*`. Import path unchanged.
 *
 * @module models/customerModel
 */
import {
  findAllCustomers,
  findCustomersPaginated,
  findCustomerByNumber,
} from '../repositories/customer/customerFinder.js';
import { findCustomerProfile } from '../repositories/customer/customerProfile.js';

/** Raw row from the single profile query (before service-layer mapping). */
export interface CustomerProfileDbRow {
  kundenr: string;
  kundenavn: string | null;
  customer_group_id: number | null;
  customer_group_name: string | null;
  customer_group_description: string | null;
  portal_username: string | null;
  account_created_at: string | null;
  primary_firma: string | null;
  primary_lager: string | null;
  contact_refs_json: unknown;
  order_count: number;
  total_revenue: number;
  active_orders: number;
  first_order_date: string | null;
  last_order_date: string | null;
}

export const customerModel = {
  findAll: () => findAllCustomers(),

  findAllPaginated: (options?: { page?: number; limit?: number }) =>
    findCustomersPaginated(options),

  findByNumber: (kundenr: string) => findCustomerByNumber(kundenr),

  findProfileByNumber: (kundenr: string): Promise<CustomerProfileDbRow | null> =>
    findCustomerProfile(kundenr),
};
