import { useState } from 'react';
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
} from '../../../types/pricing';
import { usePricingMutations } from '../../../hooks/pricing/usePricingMutations';
import {
  useCustomersWithGroups,
  usePricingGroups,
  usePricingLists,
  usePricingProductGroups,
  usePricingRules,
} from '../../../hooks/pricing/usePricingQueries';

export function usePricingData() {
  const [selectedListId, setSelectedListId] = useState<number | null>(null);

  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showListForm, setShowListForm] = useState(false);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState<CustomerGroup | null>(null);
  const [editingList, setEditingList] = useState<PriceList | null>(null);
  const [editingRule, setEditingRule] = useState<PriceRule | null>(null);

  const [groupForm, setGroupForm] = useState<GroupFormData>(INITIAL_GROUP_FORM);
  const [listForm, setListForm] = useState<ListFormData>(INITIAL_LIST_FORM);
  const [ruleForm, setRuleForm] = useState<RuleFormData>(INITIAL_RULE_FORM);

  const groupsQuery = usePricingGroups();
  const listsQuery = usePricingLists();
  const customersQuery = useCustomersWithGroups();
  const productGroupsQuery = usePricingProductGroups();
  const rulesQuery = usePricingRules(selectedListId);
  const isLoading =
    groupsQuery.isLoading ||
    listsQuery.isLoading ||
    customersQuery.isLoading ||
    productGroupsQuery.isLoading;

  const mutations = usePricingMutations(selectedListId);

  const loadRules = (listId: number) => {
    setSelectedListId(listId);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutations.createGroup.mutateAsync(groupForm);
    setShowGroupForm(false);
    setGroupForm(INITIAL_GROUP_FORM);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    await mutations.updateGroup.mutateAsync({ id: editingGroup.id, data: groupForm });
    setEditingGroup(null);
    setGroupForm(INITIAL_GROUP_FORM);
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne gruppen?')) return;
    await mutations.deleteGroup.mutateAsync(id);
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    await mutations.createList.mutateAsync(listForm);
    setShowListForm(false);
    setListForm(INITIAL_LIST_FORM);
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    await mutations.updateList.mutateAsync({ id: editingList.id, data: listForm });
    setEditingList(null);
    setListForm(INITIAL_LIST_FORM);
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne prislisten? Alle regler vil også bli slettet.')) return;
    await mutations.deleteList.mutateAsync(id);
    if (selectedListId === id) {
      setSelectedListId(null);
    }
  };

  const handleToggleListActive = async (list: PriceList) => {
    await mutations.toggleListActive.mutateAsync({ id: list.id, isActive: !list.is_active });
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;
    await mutations.createRule.mutateAsync({ listId: selectedListId, ruleForm });
    setShowRuleForm(false);
    setRuleForm(INITIAL_RULE_FORM);
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !selectedListId) return;
    await mutations.updateRule.mutateAsync({ id: editingRule.id, ruleForm });
    setShowRuleForm(false);
    setEditingRule(null);
    setRuleForm(INITIAL_RULE_FORM);
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne regelen?')) return;
    await mutations.deleteRule.mutateAsync(id);
  };

  const handleAssignCustomer = async (kundenr: string, groupId: number | null) => {
    await mutations.assignCustomer.mutateAsync({ kundenr, groupId });
  };

  return {
    isLoading,
    groups: groupsQuery.data ?? ([] as CustomerGroup[]),
    lists: listsQuery.data ?? ([] as PriceList[]),
    rules: rulesQuery.data ?? ([] as PriceRule[]),
    customersWithGroups: customersQuery.data ?? ([] as CustomerWithGroup[]),
    productGroups: productGroupsQuery.data ?? ([] as string[]),
    selectedListId,
    showGroupForm,
    showListForm,
    showRuleForm,
    editingGroup,
    editingList,
    editingRule,
    groupForm,
    listForm,
    ruleForm,
    setShowGroupForm,
    setShowListForm,
    setShowRuleForm,
    setEditingGroup,
    setEditingList,
    setEditingRule,
    setGroupForm,
    setListForm,
    setRuleForm,
    loadRules,
    handleCreateGroup,
    handleUpdateGroup,
    handleDeleteGroup,
    handleCreateList,
    handleUpdateList,
    handleDeleteList,
    handleToggleListActive,
    handleCreateRule,
    handleUpdateRule,
    handleDeleteRule,
    handleAssignCustomer,
  };
}
