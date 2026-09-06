import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { pricingApi } from '../../lib/api';
import { getApiError } from '../../lib/apiErrors';
import { pricingKeys, kundeKeys } from '../../lib/queryKeys';
import { parseNonNegativeNumber } from '../../lib/formatters';
import type { GroupFormData, ListFormData, RuleFormData } from '../../types/pricing';

function buildRulePayload(selectedListId: number, ruleForm: RuleFormData) {
  const data: Record<string, unknown> = {
    price_list_id: selectedListId,
    min_quantity: ruleForm.min_quantity,
  };

  if (ruleForm.varekode) data.varekode = ruleForm.varekode;
  if (ruleForm.varegruppe) data.varegruppe = ruleForm.varegruppe;
  if (ruleForm.kundenr) data.kundenr = ruleForm.kundenr;
  if (ruleForm.customer_group_id) data.customer_group_id = parseInt(ruleForm.customer_group_id, 10);

  if (ruleForm.discount_type === 'percent' && ruleForm.discount_percent !== '') {
    const discount = parseNonNegativeNumber(ruleForm.discount_percent);
    if (discount != null && discount <= 100) data.discount_percent = discount;
  } else if (ruleForm.discount_type === 'fixed' && ruleForm.fixed_price !== '') {
    const fixed = parseNonNegativeNumber(ruleForm.fixed_price);
    if (fixed != null && fixed >= 0) data.fixed_price = fixed;
  }

  return data;
}

export function usePricingMutations(selectedListId: number | null) {
  const queryClient = useQueryClient();

  const invalidateCatalog = () => {
    void queryClient.invalidateQueries({ queryKey: pricingKeys.all() });
    void queryClient.invalidateQueries({ queryKey: pricingKeys.groups() });
    void queryClient.invalidateQueries({ queryKey: pricingKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: pricingKeys.customersWithGroups() });
    // Pricing changes affect customer effective prices -> drop stale catalog + Mine priser.
    void queryClient.invalidateQueries({ queryKey: kundeKeys.catalogRoot() });
    void queryClient.invalidateQueries({ queryKey: ['kunde', 'pricing'] });
  };

  const invalidateRules = () => {
    if (selectedListId != null) {
      void queryClient.invalidateQueries({ queryKey: pricingKeys.rules(selectedListId) });
    }
  };

  const createGroup = useMutation({
    mutationFn: (data: GroupFormData) => pricingApi.createGroup(data),
    onSuccess: () => {
      toast.success('Gruppe opprettet');
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke opprette gruppe')),
  });

  const updateGroup = useMutation({
    mutationFn: ({ id, data }: { id: number; data: GroupFormData }) => pricingApi.updateGroup(id, data),
    onSuccess: () => {
      toast.success('Gruppe oppdatert');
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke oppdatere gruppe')),
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => pricingApi.deleteGroup(id),
    onSuccess: () => {
      toast.success('Gruppe slettet');
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke slette gruppe')),
  });

  const createList = useMutation({
    mutationFn: (data: ListFormData) =>
      pricingApi.createList({
        ...data,
        valid_from: data.valid_from ? `${data.valid_from}T00:00:00Z` : undefined,
        valid_to: data.valid_to ? `${data.valid_to}T23:59:59Z` : undefined,
      }),
    onSuccess: () => {
      toast.success('Prisliste opprettet');
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke opprette prisliste')),
  });

  const updateList = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ListFormData }) =>
      pricingApi.updateList(id, {
        ...data,
        valid_from: data.valid_from ? `${data.valid_from}T00:00:00Z` : null,
        valid_to: data.valid_to ? `${data.valid_to}T23:59:59Z` : null,
      }),
    onSuccess: () => {
      toast.success('Prisliste oppdatert');
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke oppdatere prisliste')),
  });

  const deleteList = useMutation({
    mutationFn: (id: number) => pricingApi.deleteList(id),
    onSuccess: () => {
      toast.success('Prisliste slettet');
      invalidateCatalog();
      invalidateRules();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke slette prisliste')),
  });

  const toggleListActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      pricingApi.updateList(id, { is_active: isActive }),
    onSuccess: () => invalidateCatalog(),
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke oppdatere status')),
  });

  const createRule = useMutation({
    mutationFn: ({ listId, ruleForm }: { listId: number; ruleForm: RuleFormData }) =>
      pricingApi.createRule(
        buildRulePayload(listId, ruleForm) as Parameters<typeof pricingApi.createRule>[0],
      ),
    onSuccess: () => {
      toast.success('Regel opprettet');
      invalidateRules();
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke opprette regel')),
  });

  const updateRule = useMutation({
    mutationFn: ({ id, ruleForm }: { id: number; ruleForm: RuleFormData }) => {
      const data: Record<string, unknown> = {
        min_quantity: ruleForm.min_quantity,
        varekode: ruleForm.varekode || null,
        varegruppe: ruleForm.varegruppe || null,
        kundenr: ruleForm.kundenr || null,
        customer_group_id: ruleForm.customer_group_id ? parseInt(ruleForm.customer_group_id, 10) : null,
      };

      if (ruleForm.discount_type === 'percent' && ruleForm.discount_percent !== '') {
        const discount = parseNonNegativeNumber(ruleForm.discount_percent);
        if (discount != null && discount <= 100) {
          data.discount_percent = discount;
          data.fixed_price = null;
        }
      } else if (ruleForm.discount_type === 'fixed' && ruleForm.fixed_price !== '') {
        const fixed = parseNonNegativeNumber(ruleForm.fixed_price);
        if (fixed != null && fixed >= 0) {
          data.fixed_price = fixed;
          data.discount_percent = null;
        }
      }

      return pricingApi.updateRule(id, data);
    },
    onSuccess: () => {
      toast.success('Regel oppdatert');
      invalidateRules();
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke oppdatere regel')),
  });

  const deleteRule = useMutation({
    mutationFn: (id: number) => pricingApi.deleteRule(id),
    onSuccess: () => {
      toast.success('Regel slettet');
      invalidateRules();
      invalidateCatalog();
    },
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke slette regel')),
  });

  const assignCustomer = useMutation({
    mutationFn: ({ kundenr, groupId }: { kundenr: string; groupId: number | null }) =>
      groupId ? pricingApi.assignCustomer(groupId, kundenr) : pricingApi.removeCustomerFromGroup(kundenr),
    onSuccess: () => invalidateCatalog(),
    onError: (err) => toast.error(getApiError(err, 'Kunne ikke oppdatere kunde')),
  });

  return {
    createGroup,
    updateGroup,
    deleteGroup,
    createList,
    updateList,
    deleteList,
    toggleListActive,
    createRule,
    updateRule,
    deleteRule,
    assignCustomer,
  };
}
