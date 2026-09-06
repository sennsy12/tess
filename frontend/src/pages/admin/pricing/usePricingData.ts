import { useState } from 'react';
import toast from 'react-hot-toast';
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
import { validateRuleForm } from './components/RulesTab';

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
    try {
      await mutations.createGroup.mutateAsync(groupForm);
    } catch {
      return; // onError toast already handles
    }
    setShowGroupForm(false);
    setGroupForm(INITIAL_GROUP_FORM);
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    try {
      await mutations.updateGroup.mutateAsync({ id: editingGroup.id, data: groupForm });
    } catch {
      return; // onError toast already handles
    }
    setEditingGroup(null);
    setGroupForm(INITIAL_GROUP_FORM);
  };

  const handleDeleteGroup = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne gruppen?')) return;
    try {
      await mutations.deleteGroup.mutateAsync(id);
    } catch {
      return; // onError toast already handles
    }
  };

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (listForm.valid_from && listForm.valid_to && listForm.valid_from > listForm.valid_to) {
      toast.error('Fra-dato må være før til-dato');
      return;
    }
    if (!Number.isInteger(listForm.priority) || listForm.priority < 0 || listForm.priority > 1000) {
      toast.error('Prioritet må være mellom 0 og 1000');
      return;
    }
    if (listForm.name.length > 100) {
      toast.error('Navn kan ikke være lenger enn 100 tegn');
      return;
    }
    if ((listForm.description?.length ?? 0) > 500) {
      toast.error('Beskrivelse kan ikke være lenger enn 500 tegn');
      return;
    }
    try {
      await mutations.createList.mutateAsync(listForm);
    } catch {
      return; // onError toast already handles
    }
    setShowListForm(false);
    setListForm(INITIAL_LIST_FORM);
  };

  const handleUpdateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingList) return;
    if (listForm.valid_from && listForm.valid_to && listForm.valid_from > listForm.valid_to) {
      toast.error('Fra-dato må være før til-dato');
      return;
    }
    if (!Number.isInteger(listForm.priority) || listForm.priority < 0 || listForm.priority > 1000) {
      toast.error('Prioritet må være mellom 0 og 1000');
      return;
    }
    if (listForm.name.length > 100) {
      toast.error('Navn kan ikke være lenger enn 100 tegn');
      return;
    }
    if ((listForm.description?.length ?? 0) > 500) {
      toast.error('Beskrivelse kan ikke være lenger enn 500 tegn');
      return;
    }
    try {
      await mutations.updateList.mutateAsync({ id: editingList.id, data: listForm });
    } catch {
      return; // onError toast already handles
    }
    setEditingList(null);
    setListForm(INITIAL_LIST_FORM);
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne prislisten? Alle regler vil også bli slettet.')) return;
    try {
      await mutations.deleteList.mutateAsync(id);
    } catch {
      return; // onError toast already handles
    }
    if (selectedListId === id) {
      setSelectedListId(null);
    }
  };

  const handleToggleListActive = async (list: PriceList) => {
    try {
      await mutations.toggleListActive.mutateAsync({ id: list.id, isActive: !list.is_active });
    } catch {
      return; // onError toast already handles
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;
    const validationError = validateRuleForm(ruleForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      await mutations.createRule.mutateAsync({ listId: selectedListId, ruleForm });
    } catch {
      return; // onError toast already handles
    }
    setShowRuleForm(false);
    setRuleForm(INITIAL_RULE_FORM);
  };

  const handleUpdateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRule || !selectedListId) return;
    const validationError = validateRuleForm(ruleForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    try {
      await mutations.updateRule.mutateAsync({ id: editingRule.id, ruleForm });
    } catch {
      return; // onError toast already handles
    }
    setShowRuleForm(false);
    setEditingRule(null);
    setRuleForm(INITIAL_RULE_FORM);
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Er du sikker på at du vil slette denne regelen?')) return;
    try {
      await mutations.deleteRule.mutateAsync(id);
    } catch {
      return; // onError toast already handles
    }
  };

  const handleAssignCustomer = async (kundenr: string, groupId: number | null) => {
    try {
      await mutations.assignCustomer.mutateAsync({ kundenr, groupId });
    } catch {
      return; // onError toast already handles
    }
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
