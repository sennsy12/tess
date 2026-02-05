import { useState } from 'react';
import { Layout } from '../../../components/Layout';
import { usePricingData } from './usePricingData';
import { GroupsTab, ListsTab, RulesTab, CustomersTab, PreviewTab } from './components';
import { Tab, TABS } from './types';

export function AdminPricing() {
  const [activeTab, setActiveTab] = useState<Tab>('groups');
  const pricing = usePricingData();

  if (pricing.isLoading) {
    return (
      <Layout title="Prisstyring">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Prisstyring">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-dark-700 pb-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-800 text-dark-300 hover:bg-dark-700'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'groups' && (
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
          />
        )}

        {activeTab === 'lists' && (
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
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === 'rules' && (
          <RulesTab
            rules={pricing.rules}
            lists={pricing.lists}
            groups={pricing.groups}
            productGroups={pricing.productGroups}
            selectedListId={pricing.selectedListId}
            showRuleForm={pricing.showRuleForm}
            ruleForm={pricing.ruleForm}
            setShowRuleForm={pricing.setShowRuleForm}
            setRuleForm={pricing.setRuleForm}
            loadRules={pricing.loadRules}
            handleCreateRule={pricing.handleCreateRule}
            handleDeleteRule={pricing.handleDeleteRule}
          />
        )}

        {activeTab === 'customers' && (
          <CustomersTab
            customersWithGroups={pricing.customersWithGroups}
            groups={pricing.groups}
            handleAssignCustomer={pricing.handleAssignCustomer}
          />
        )}

        {activeTab === 'preview' && (
          <PreviewTab
            customersWithGroups={pricing.customersWithGroups}
          />
        )}
      </div>
    </Layout>
  );
}
