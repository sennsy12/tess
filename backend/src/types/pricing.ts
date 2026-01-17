/**
 * Pricing System Type Definitions
 * Provides strong typing for all pricing-related entities
 */

// ============================================
// CUSTOMER GROUP TYPES
// ============================================

export interface CustomerGroup {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
}

export interface CreateCustomerGroupInput {
  name: string;
  description?: string;
}

// ============================================
// PRICE LIST TYPES
// ============================================

export interface PriceList {
  id: number;
  name: string;
  description: string | null;
  valid_from: Date | null;
  valid_to: Date | null;
  priority: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CreatePriceListInput {
  name: string;
  description?: string;
  valid_from?: string;
  valid_to?: string;
  priority?: number;
  is_active?: boolean;
}

export interface UpdatePriceListInput {
  name?: string;
  description?: string;
  valid_from?: string | null;
  valid_to?: string | null;
  priority?: number;
  is_active?: boolean;
}

// ============================================
// PRICE RULE TYPES
// ============================================

export interface PriceRule {
  id: number;
  price_list_id: number;
  varekode: string | null;
  varegruppe: string | null;
  kundenr: string | null;
  customer_group_id: number | null;
  min_quantity: number;
  discount_percent: number | null;
  fixed_price: number | null;
  created_at: Date;
  // Joined fields
  price_list_name?: string;
  customer_group_name?: string;
}

export interface CreatePriceRuleInput {
  price_list_id: number;
  varekode?: string;
  varegruppe?: string;
  kundenr?: string;
  customer_group_id?: number;
  min_quantity?: number;
  discount_percent?: number;
  fixed_price?: number;
}

export interface UpdatePriceRuleInput {
  varekode?: string | null;
  varegruppe?: string | null;
  kundenr?: string | null;
  customer_group_id?: number | null;
  min_quantity?: number;
  discount_percent?: number | null;
  fixed_price?: number | null;
}

// ============================================
// PRICE CALCULATION TYPES
// ============================================

export interface PriceCalculationInput {
  varekode: string;
  varegruppe?: string;
  kundenr: string;
  quantity: number;
  base_price: number;
}

export interface PriceCalculationResult {
  original_price: number;
  final_price: number;
  unit_price: number;
  discount_applied: boolean;
  discount_percent: number | null;
  discount_amount: number;
  applied_rule_id: number | null;
  applied_rule_name: string | null;
  applied_list_name: string | null;
}

// ============================================
// CUSTOMER WITH GROUP (Extended)
// ============================================

export interface CustomerWithGroup {
  kundenr: string;
  kundenavn: string;
  customer_group_id: number | null;
  customer_group_name: string | null;
}
