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

export interface RuleConflict {
  conflicting_rule_id: number;
  conflicting_rule: PriceRule;
  overlap_reason: string;
  severity: 'warning' | 'info';
}

export interface AuditEntry {
  id: number;
  timestamp: string;
  user_id: number | null;
  username: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  entity_type: string;
  entity_id: string;
  entity_name: string | null;
  changes: Record<string, { old: any; new: any }> | null;
  metadata: Record<string, any> | null;
  ip_address: string | null;
}

// ── Simulation types ──────────────────────────────────────

export interface RevenueBucket {
  total_revenue: number;
  total_discount: number;
  affected_orders: number;
  affected_lines: number;
}

export interface CustomerImpact {
  kundenr: string;
  kundenavn: string;
  current_revenue: number;
  simulated_revenue: number;
  difference: number;
  difference_pct: number;
}

export interface ProductImpact {
  varekode: string;
  varenavn: string;
  current_revenue: number;
  simulated_revenue: number;
  difference: number;
  difference_pct: number;
}

export interface TrendPoint {
  date: string;
  current_revenue: number;
  simulated_revenue: number;
}

export interface SimulationResult {
  current: RevenueBucket;
  simulated: RevenueBucket;
  revenue_difference: number;
  revenue_difference_pct: number;
  orders_analysed: number;
  top_customers: CustomerImpact[];
  top_products: ProductImpact[];
  trend: TrendPoint[];
  computation_time_ms: number;
}

export type Tab = 'groups' | 'lists' | 'rules' | 'customers' | 'preview' | 'audit' | 'simulator';

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

export interface SimulatorForm {
  price_list_id: string;
  scope: 'all' | 'product' | 'category';
  varekode: string;
  varegruppe: string;
  target: 'all' | 'customer' | 'group';
  kundenr: string;
  customer_group_id: string;
  min_quantity: number;
  discount_type: 'percent' | 'fixed';
  discount_percent: string;
  fixed_price: string;
  start_date: string;
  end_date: string;
  sample_size: number;
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

export const INITIAL_SIMULATOR_FORM: SimulatorForm = {
  price_list_id: '',
  scope: 'all',
  varekode: '',
  varegruppe: '',
  target: 'all',
  kundenr: '',
  customer_group_id: '',
  min_quantity: 0,
  discount_type: 'percent',
  discount_percent: '',
  fixed_price: '',
  start_date: '',
  end_date: '',
  sample_size: 1000,
};

export const TABS = [
  { id: 'groups' as Tab, label: 'Kundegrupper', icon: '👥' },
  { id: 'lists' as Tab, label: 'Prislister', icon: '📋' },
  { id: 'rules' as Tab, label: 'Prisregler', icon: '💰' },
  { id: 'customers' as Tab, label: 'Tildeling', icon: '🔗' },
  { id: 'preview' as Tab, label: 'Test priser', icon: '🔍' },
  { id: 'simulator' as Tab, label: 'Simulator', icon: '🧪' },
  { id: 'audit' as Tab, label: 'Endringslogg', icon: '📜' },
];

// ── Component Prop Interfaces ─────────────────────────

export interface GroupsTabProps {
  groups: CustomerGroup[];
  showGroupForm: boolean;
  editingGroup: CustomerGroup | null;
  groupForm: GroupFormData;
  setShowGroupForm: (show: boolean) => void;
  setEditingGroup: (group: CustomerGroup | null) => void;
  setGroupForm: (form: GroupFormData) => void;
  handleCreateGroup: (e: React.FormEvent) => void;
  handleUpdateGroup: (e: React.FormEvent) => void;
  handleDeleteGroup: (id: number) => void;
}

export interface ListsTabProps {
  lists: PriceList[];
  showListForm: boolean;
  editingList: PriceList | null;
  listForm: ListFormData;
  setShowListForm: (show: boolean) => void;
  setEditingList: (list: PriceList | null) => void;
  setListForm: (form: ListFormData) => void;
  handleCreateList: (e: React.FormEvent) => void;
  handleUpdateList: (e: React.FormEvent) => void;
  handleDeleteList: (id: number) => void;
  handleToggleListActive: (list: PriceList) => void;
  loadRules: (listId: number) => void;
  setActiveTab: (tab: Tab) => void;
}

export interface RulesTabProps {
  rules: PriceRule[];
  lists: PriceList[];
  groups: CustomerGroup[];
  productGroups: string[];
  selectedListId: number | null;
  showRuleForm: boolean;
  ruleForm: RuleFormData;
  editingRule: PriceRule | null;
  setShowRuleForm: (show: boolean) => void;
  setRuleForm: (form: RuleFormData) => void;
  setEditingRule: (rule: PriceRule | null) => void;
  loadRules: (listId: number) => void;
  handleCreateRule: (e: React.FormEvent) => void;
  handleUpdateRule: (e: React.FormEvent) => void;
  handleDeleteRule: (id: number) => void;
}

export interface CustomersTabProps {
  groups: CustomerGroup[];
  handleAssignCustomer: (kundenr: string, groupId: number | null) => void;
  initialState?: {
    search: string;
    filterGroup: string;
    pageSize: number;
  };
  onStateChange?: (state: { search: string; filterGroup: string; pageSize: number }) => void;
}

export interface PreviewTabProps {
  customersWithGroups: CustomerWithGroup[];
}

export interface AuditLogTabProps {
  // Add specific props if needed, currently used without props or internal only
}

