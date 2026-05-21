export interface KundeProfileStats {
  order_count: number;
  total_revenue: number;
  active_orders: number;
  first_order_date: string | null;
  last_order_date: string | null;
}

export interface KundeProfile {
  kundenr: string;
  kundenavn: string | null;
  customer_group_id: number | null;
  customer_group_name: string | null;
  customer_group_description: string | null;
  portal_username: string | null;
  account_created_at: string | null;
  primary_firma: string | null;
  primary_lager: string | null;
  contact_refs: string[];
  stats: KundeProfileStats;
}
