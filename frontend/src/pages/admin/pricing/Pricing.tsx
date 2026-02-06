import { useState } from 'react';
import { Layout } from '../../../components/Layout';
import { Tabs, TabContent } from '../../../components/Tabs';
import { usePricingData } from './usePricingData';
import { GroupsTab, ListsTab, RulesTab, CustomersTab, PreviewTab, AuditLogTab } from './components';
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
        <Tabs
          tabs={TABS}
          activeTab={activeTab}
          onChange={(tab) => setActiveTab(tab as Tab)}
          variant="underline"
        />

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
              setActiveTab={setActiveTab}
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

        {activeTab === 'audit' && (
          <TabContent tabKey="audit">
            <AuditLogTab />
          </TabContent>
        )}
      </div>
    </Layout>
  );
}
