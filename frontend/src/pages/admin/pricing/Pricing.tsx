import { useEffect, useMemo, useRef, useState } from 'react';
import { Layout } from '../../../components/Layout';
import { Breadcrumb } from '../../../components/Breadcrumb';
import { SavedViewsPanel } from '../../../components/SavedViewsPanel';
import { Tabs, TabContent } from '../../../components/Tabs';
import { Spinner } from '../../../components/Spinner';
import { useSavedViews } from '../../../hooks/useSavedViews';
import { usePricingData } from './usePricingData';
import {
  GroupsTab,
  ListsTab,
  RulesTab,
  CustomersTab,
  PreviewTab,
  SimulatorTab,
  AuditLogTab,
  PricingGuide,
} from './components';
import {
  Tab,
  PricingSection,
  SETUP_TABS,
  TOOL_TABS,
  TAB_DESCRIPTIONS,
  getPricingSection,
} from '../../../types/pricing';

const SECTION_LABELS: Record<PricingSection, { title: string; description: string }> = {
  setup: {
    title: 'Oppsett',
    description: 'Bygg grunnstrukturen for prisberegning',
  },
  tools: {
    title: 'Verktøy',
    description: 'Test, simuler og spor endringer',
  },
};

export function AdminPricing() {
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const [section, setSection] = useState<PricingSection>('setup');
  const [customerFilters, setCustomerFilters] = useState({
    search: '',
    filterGroup: 'all',
    pageSize: 25,
  });
  const pricing = usePricingData();
  const hasAppliedDefaultView = useRef(false);

  const hasOpenForms =
    pricing.showGroupForm || pricing.showListForm || pricing.showRuleForm;

  const guideStats = useMemo(
    () => ({
      groups: pricing.groups.length,
      lists: pricing.lists.length,
      activeLists: pricing.lists.filter((l) => l.is_active).length,
      assignedCustomers: pricing.customersWithGroups.filter((c) => c.customer_group_id !== null).length,
    }),
    [pricing.groups, pricing.lists, pricing.customersWithGroups],
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasOpenForms) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasOpenForms]);

  const navigateToTab = (tab: Tab) => {
    setSection(getPricingSection(tab));
    setActiveTab(tab);
  };

  const handleTabChange = (tab: Tab) => {
    if (hasOpenForms && !window.confirm('Du har ulagrede endringer. Vil du bytte fane uten å lagre?')) {
      return;
    }
    setActiveTab(tab);
  };

  const handleSectionChange = (next: PricingSection) => {
    if (hasOpenForms && !window.confirm('Du har ulagrede endringer. Vil du bytte seksjon uten å lagre?')) {
      return;
    }
    setSection(next);
    const tabs = next === 'setup' ? SETUP_TABS : TOOL_TABS;
    if (!tabs.some((t) => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  };

  const workspaceState = {
    activeTab,
    selectedListId: pricing.selectedListId,
    customerFilters,
  };

  const {
    views,
    defaultView,
    canUseShared,
    isLoading: viewsLoading,
    saveView,
    deleteView,
    setDefaultView,
  } = useSavedViews({
    scope: 'admin-pricing',
    state: workspaceState,
    enabledShared: true,
  });

  useEffect(() => {
    if (!defaultView || hasAppliedDefaultView.current) return;
    hasAppliedDefaultView.current = true;
    navigateToTab(defaultView.state.activeTab);
    setCustomerFilters(defaultView.state.customerFilters);
    if (defaultView.state.selectedListId) {
      pricing.loadRules(defaultView.state.selectedListId);
    }
  }, [defaultView, pricing]);

  const sectionTabs = section === 'setup' ? SETUP_TABS : TOOL_TABS;

  if (pricing.isLoading) {
    return (
      <Layout title="Prisstyring">
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" className="text-primary-500" label="Laster prisstyring�" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Prisstyring">
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: 'Dashboard', to: '/admin' },
            { label: 'Prisstyring' },
          ]}
        />

        <PricingGuide
          stats={guideStats}
          activeTab={activeTab}
          onNavigate={navigateToTab}
        />

        {/* Section switcher */}
        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="inline-flex gap-1 rounded-xl bg-dark-800/80 p-1">
              {(Object.keys(SECTION_LABELS) as PricingSection[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSectionChange(key)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    section === key
                      ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/20'
                      : 'text-dark-400 hover:text-dark-200'
                  }`}
                >
                  {SECTION_LABELS[key].title}
                </button>
              ))}
            </div>
            <p className="text-sm text-dark-500">{SECTION_LABELS[section].description}</p>
          </div>

          <Tabs
            tabs={sectionTabs}
            activeTab={activeTab}
            onChange={(tab) => handleTabChange(tab as Tab)}
            variant="underline"
          />

          <p className="text-sm text-dark-400 border-l-2 border-primary-500/40 pl-3">
            {TAB_DESCRIPTIONS[activeTab]}
          </p>
        </div>

        {/* Tab Content */}
        {activeTab === 'groups' && (
          <TabContent tabKey="groups">
            <GroupsTab
              groups={pricing.groups}
              showGroupForm={pricing.showGroupForm}
              editingGroup={pricing.editingGroup}
              groupForm={pricing.groupForm}
              setShowGroupForm={pricing.setShowGroupForm}
              setEditingGroup={pricing.setEditingGroup}
              setGroupForm={pricing.setGroupForm}
              handleCreateGroup={pricing.handleCreateGroup}
              handleUpdateGroup={pricing.handleUpdateGroup}
              handleDeleteGroup={pricing.handleDeleteGroup}
              onContinue={() => navigateToTab('lists')}
            />
          </TabContent>
        )}

        {activeTab === 'lists' && (
          <TabContent tabKey="lists">
            <ListsTab
              lists={pricing.lists}
              showListForm={pricing.showListForm}
              editingList={pricing.editingList}
              listForm={pricing.listForm}
              setShowListForm={pricing.setShowListForm}
              setEditingList={pricing.setEditingList}
              setListForm={pricing.setListForm}
              handleCreateList={pricing.handleCreateList}
              handleUpdateList={pricing.handleUpdateList}
              handleDeleteList={pricing.handleDeleteList}
              handleToggleListActive={pricing.handleToggleListActive}
              loadRules={pricing.loadRules}
              setActiveTab={navigateToTab}
            />
          </TabContent>
        )}

        {activeTab === 'rules' && (
          <TabContent tabKey="rules">
            <RulesTab
              rules={pricing.rules}
              lists={pricing.lists}
              groups={pricing.groups}
              productGroups={pricing.productGroups}
              selectedListId={pricing.selectedListId}
              showRuleForm={pricing.showRuleForm}
              ruleForm={pricing.ruleForm}
              editingRule={pricing.editingRule}
              setShowRuleForm={pricing.setShowRuleForm}
              setRuleForm={pricing.setRuleForm}
              setEditingRule={pricing.setEditingRule}
              loadRules={pricing.loadRules}
              handleCreateRule={pricing.handleCreateRule}
              handleUpdateRule={pricing.handleUpdateRule}
              handleDeleteRule={pricing.handleDeleteRule}
            />
          </TabContent>
        )}

        {activeTab === 'customers' && (
          <TabContent tabKey="customers">
            <CustomersTab
              groups={pricing.groups}
              handleAssignCustomer={pricing.handleAssignCustomer}
              initialState={customerFilters}
              onStateChange={setCustomerFilters}
            />
          </TabContent>
        )}

        {activeTab === 'preview' && (
          <TabContent tabKey="preview">
            <PreviewTab
              customersWithGroups={pricing.customersWithGroups}
            />
          </TabContent>
        )}

        {activeTab === 'simulator' && (
          <TabContent tabKey="simulator">
            <SimulatorTab
              lists={pricing.lists}
              groups={pricing.groups}
            />
          </TabContent>
        )}

        {activeTab === 'audit' && (
          <TabContent tabKey="audit">
            <AuditLogTab />
          </TabContent>
        )}

        <SavedViewsPanel
          title="Lagrede arbeidsflater"
          description="Lagre aktiv fane, valgt prisliste og tildelingsfiltre. Del oppsett med andre administratorer."
          views={views}
          isLoading={viewsLoading}
          canShare={canUseShared}
          onApply={(view) => {
            navigateToTab(view.state.activeTab);
            setCustomerFilters(view.state.customerFilters);
            if (view.state.selectedListId) {
              pricing.loadRules(view.state.selectedListId);
            }
          }}
          onSave={(name, options) => saveView(name, options)}
          onDelete={(view) => deleteView(view)}
          onSetDefault={setDefaultView}
        />
      </div>
    </Layout>
  );
}
