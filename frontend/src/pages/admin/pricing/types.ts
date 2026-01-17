// Pricing System Types

export interface CustomerGroup {
  id: number;
  name: string;
  description: string | null;
}

export interface PriceList {
  id: number;
  name: string;
  description: string | null;
  valid_from: string | null;
  valid_to: string | null;
  priority: number;
  is_active: boolean;
}

export interface PriceRule {
  id: number;
  price_list_id: number;
  varekode: string | null;
  varegruppe: string | null;
  kundenr: string | null;
  customer_group_id: number | null;
  customer_group_name?: string | null;
  min_quantity: number;
  discount_percent: number | null;
  fixed_price: number | null;
}

export interface CustomerWithGroup {
  kundenr: string;
  kundenavn: string;
  customer_group_id: number | null;
  customer_group_name: string | null;
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

export type Tab = 'groups' | 'lists' | 'rules' | 'customers' | 'preview';

export interface GroupFormData {
  name: string;
  description: string;
}

export interface ListFormData {
  name: string;
  description: string;
  valid_from: string;
  valid_to: string;
  priority: number;
  is_active: boolean;
}

export interface RuleFormData {
  price_list_id: number;
  varekode: string;
  varegruppe: string;
  kundenr: string;
  customer_group_id: string;
  min_quantity: number;
  discount_type: 'percent' | 'fixed';
  discount_percent: string;
  fixed_price: string;
}

export const INITIAL_GROUP_FORM: GroupFormData = { name: '', description: '' };

export const INITIAL_LIST_FORM: ListFormData = {
  name: '',
  description: '',
  valid_from: '',
  valid_to: '',
  priority: 0,
  is_active: true,
};

export const INITIAL_RULE_FORM: RuleFormData = {
  price_list_id: 0,
  varekode: '',
  varegruppe: '',
  kundenr: '',
  customer_group_id: '',
  min_quantity: 1,
  discount_type: 'percent',
  discount_percent: '',
  fixed_price: '',
};

export const TABS = [
  { id: 'groups' as Tab, label: 'Kundegrupper', icon: '👥' },
  { id: 'lists' as Tab, label: 'Prislister', icon: '📋' },
  { id: 'rules' as Tab, label: 'Prisregler', icon: '💰' },
  { id: 'customers' as Tab, label: 'Tildeling', icon: '🔗' },
  { id: 'preview' as Tab, label: 'Test priser', icon: '🔍' },
];
