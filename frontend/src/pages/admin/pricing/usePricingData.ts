import { useState, useEffect, useCallback } from 'react';
import { pricingApi, productsApi } from '../../../lib/api';
import {
  CustomerGroup,
  PriceList,
  PriceRule,
  CustomerWithGroup,
  GroupFormData,
  ListFormData,
  RuleFormData,
  INITIAL_GROUP_FORM,
  INITIAL_LIST_FORM,
  INITIAL_RULE_FORM,
} from './types';

export function usePricingData() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Data states
  const [groups, setGroups] = useState<CustomerGroup[]>([]);
  const [lists, setLists] = useState<PriceList[]>([]);
  const [rules, setRules] = useState<PriceRule[]>([]);
  const [customersWithGroups, setCustomersWithGroups] = useState<CustomerWithGroup[]>([]);
  const [productGroups, setProductGroups] = useState<string[]>([]);
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  // Form states
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [editingList, setEditingList] = useState<PriceList | null>(null);

  // Form values
  const [groupForm, setGroupForm] = useState<GroupFormData>(INITIAL_GROUP_FORM);
  const [listForm, setListForm] = useState<ListFormData>(INITIAL_LIST_FORM);
  const [ruleForm, setRuleForm] = useState<RuleFormData>(INITIAL_RULE_FORM);

  const showMessage = useCallback((msg: string, isError = false) => {
    if (isError) {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(null), 3000);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [groupsRes, listsRes, customersRes, productGroupsRes] = await Promise.all([
        pricingApi.getGroups(),
        pricingApi.getLists(),
        pricingApi.getCustomersWithGroups(),
        productsApi.getGroups(),
      ]);
      setGroups(groupsRes.data);
      setLists(listsRes.data);
      setCustomersWithGroups(customersRes.data);
      setProductGroups(productGroupsRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
      setError('Kunne ikke laste data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadRules = useCallback(async (listId: number) => {
    try {
      const res = await pricingApi.getRules(listId);
      setRules(res.data);
      setSelectedListId(listId);
    } catch (err) {
      console.error('Failed to load rules:', err);
      setError('Kunne ikke laste regler');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Group handlers
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await pricingApi.createGroup(groupForm);
      showMessage('Gruppe opprettet');
      setShowGroupForm(false);
      setGroupForm(INITIAL_GROUP_FORM);
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke opprette gruppe', true);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    try {
      await pricingApi.updateGroup(editingGroup.id, groupForm);
      showMessage('Gruppe oppdatert');
      setEditingGroup(null);
      setGroupForm(INITIAL_GROUP_FORM);
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke oppdatere gruppe', true);
    }
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne gruppen?')) return;
    try {
      await pricingApi.deleteGroup(id);
      showMessage('Gruppe slettet');
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke slette gruppe', true);
    }
  };

  // List handlers
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await pricingApi.createList({
        ...listForm,
        valid_from: listForm.valid_from ? `${listForm.valid_from}T00:00:00Z` : undefined,
        valid_to: listForm.valid_to ? `${listForm.valid_to}T23:59:59Z` : undefined,
      });
      showMessage('Prisliste opprettet');
      setShowListForm(false);
      setListForm(INITIAL_LIST_FORM);
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke opprette prisliste', true);
    }
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    try {
      await pricingApi.updateList(editingList.id, {
        ...listForm,
        valid_from: listForm.valid_from ? `${listForm.valid_from}T00:00:00Z` : null,
        valid_to: listForm.valid_to ? `${listForm.valid_to}T23:59:59Z` : null,
      });
      showMessage('Prisliste oppdatert');
      setEditingList(null);
      setListForm(INITIAL_LIST_FORM);
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke oppdatere prisliste', true);
    }
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne prislisten? Alle regler vil også bli slettet.')) return;
    try {
      await pricingApi.deleteList(id);
      showMessage('Prisliste slettet');
      if (selectedListId === id) {
        setSelectedListId(null);
        setRules([]);
      }
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke slette prisliste', true);
    }
  };

  const handleToggleListActive = async (list: PriceList) => {
    try {
      await pricingApi.updateList(list.id, { is_active: !list.is_active });
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke oppdatere status', true);
    }
  };

  // Rule handlers
  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;

    try {
      const data: any = {
        price_list_id: selectedListId,
        min_quantity: ruleForm.min_quantity,
      };

      if (ruleForm.varekode) data.varekode = ruleForm.varekode;
      if (ruleForm.varegruppe) data.varegruppe = ruleForm.varegruppe;
      if (ruleForm.kundenr) data.kundenr = ruleForm.kundenr;
      if (ruleForm.customer_group_id) data.customer_group_id = parseInt(ruleForm.customer_group_id);

      if (ruleForm.discount_type === 'percent' && ruleForm.discount_percent) {
        data.discount_percent = parseFloat(ruleForm.discount_percent);
      } else if (ruleForm.discount_type === 'fixed' && ruleForm.fixed_price) {
        data.fixed_price = parseFloat(ruleForm.fixed_price);
      }

      await pricingApi.createRule(data);
      showMessage('Regel opprettet');
      setShowRuleForm(false);
      setRuleForm(INITIAL_RULE_FORM);
      loadRules(selectedListId);
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke opprette regel', true);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne regelen?')) return;
    try {
      await pricingApi.deleteRule(id);
      showMessage('Regel slettet');
      if (selectedListId) loadRules(selectedListId);
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke slette regel', true);
    }
  };

  // Customer handlers
  const handleAssignCustomer = async (kundenr: string, groupId: number | null) => {
    try {
      if (groupId) {
        await pricingApi.assignCustomer(groupId, kundenr);
      } else {
        await pricingApi.removeCustomerFromGroup(kundenr);
      }
      loadData();
    } catch (err: any) {
      showMessage(err.response?.data?.error || 'Kunne ikke oppdatere kunde', true);
    }
  };

  return {
    // State
    isLoading,
    error,
    success,
    groups,
    lists,
    rules,
    customersWithGroups,
    productGroups,
    selectedListId,
    showGroupForm,
    showListForm,
    showRuleForm,
    editingGroup,
    editingList,
    groupForm,
    listForm,
    ruleForm,

    // Setters
    setShowGroupForm,
    setShowListForm,
    setShowRuleForm,
    setEditingGroup,
    setEditingList,
    setGroupForm,
    setListForm,
    setRuleForm,

    // Actions
    loadRules,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleCreateList,
    handleUpdateList,
    handleDeleteList,
    handleToggleListActive,
    handleCreateRule,
    handleDeleteRule,
    handleAssignCustomer,
  };
}
