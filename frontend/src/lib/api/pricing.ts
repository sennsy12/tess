import api from './client';

export const pricingApi = {
  // Customer Groups
  getGroups: () => api.get('/pricing/groups'),
  createGroup: (data: { name: string; description?: string }) =>
    api.post('/pricing/groups', data),
  updateGroup: (id: number, data: { name?: string; description?: string }) =>
    api.put(`/pricing/groups/${id}`, data),
  deleteGroup: (id: number) => api.delete(`/pricing/groups/${id}`),
  assignCustomer: (groupId: number, kundenr: string) =>
    api.put(`/pricing/groups/${groupId}/customers/${kundenr}`),
  removeCustomerFromGroup: (kundenr: string) =>
    api.delete(`/pricing/groups/customers/${kundenr}`),
  getCustomersWithGroups: () => api.get('/pricing/customers'),
  searchCustomers: (params: { search?: string; group?: string; page?: number; limit?: number }) =>
    api.get('/pricing/customers/search', { params }),

  // Price Lists
  getLists: (activeOnly?: boolean) =>
    api.get('/pricing/lists', { params: activeOnly ? { active: 'true' } : {} }),
  getList: (id: number) => api.get(`/pricing/lists/${id}`),
  createList: (data: {
    name: string;
    description?: string;
    valid_from?: string;
    valid_to?: string;
    priority?: number;
    is_active?: boolean;
  }) => api.post('/pricing/lists', data),
  updateList: (id: number, data: Record<string, any>) =>
    api.put(`/pricing/lists/${id}`, data),
  deleteList: (id: number) => api.delete(`/pricing/lists/${id}`),

  // Price Rules
  getRules: (listId: number) => api.get(`/pricing/lists/${listId}/rules`),
  getRule: (id: number) => api.get(`/pricing/rules/${id}`),
  createRule: (data: {
    price_list_id: number;
    varekode?: string;
    varegruppe?: string;
    kundenr?: string;
    customer_group_id?: number;
    min_quantity?: number;
    discount_percent?: number;
    fixed_price?: number;
  }) => api.post('/pricing/rules', data),
  updateRule: (id: number, data: Record<string, any>) =>
    api.put(`/pricing/rules/${id}`, data),
  deleteRule: (id: number) => api.delete(`/pricing/rules/${id}`),

  // Conflict Detection
  checkRuleConflicts: (data: {
    price_list_id: number;
    varekode?: string | null;
    varegruppe?: string | null;
    kundenr?: string | null;
    customer_group_id?: number | null;
    min_quantity?: number;
    exclude_rule_id?: number;
  }) => api.post('/pricing/rules/check-conflicts', data),

  // Price Calculation
  calculatePrice: (data: {
    varekode: string;
    varegruppe?: string;
    kundenr: string;
    quantity: number;
    base_price: number;
  }) => api.post('/pricing/calculate', data),
  calculatePricesBulk: (
    items: Array<{ varekode: string; varegruppe?: string; quantity: number; base_price: number }>,
    kundenr: string
  ) => api.post('/pricing/calculate/bulk', { items, kundenr }),
  getCustomerRules: (kundenr: string) =>
    api.get(`/pricing/customer/${kundenr}/rules`),
};
