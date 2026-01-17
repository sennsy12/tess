import { PriceRule, PriceList, CustomerGroup, RuleFormData, INITIAL_RULE_FORM } from '../types';

interface Props {
  rules: PriceRule[];
  lists: PriceList[];
  groups: CustomerGroup[];
  productGroups: string[];
  selectedListId: number | null;
  showRuleForm: boolean;
  ruleForm: RuleFormData;
  setShowRuleForm: (show: boolean) => void;
  setRuleForm: (form: RuleFormData) => void;
  loadRules: (listId: number) => void;
  handleCreateRule: (e: React.FormEvent) => void;
  handleDeleteRule: (id: number) => void;
}

export function RulesTab({
  rules,
  lists,
  groups,
  productGroups,
  selectedListId,
  showRuleForm,
  ruleForm,
  setShowRuleForm,
  setRuleForm,
  loadRules,
  handleCreateRule,
  handleDeleteRule,
}: Props) {
  return (
    <div className="card">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Prisregler</h3>
          <select
            value={selectedListId || ''}
            onChange={(e) => e.target.value && loadRules(parseInt(e.target.value))}
            className="input"
          >
            <option value="">Velg prisliste...</option>
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} {!list.is_active && '(inaktiv)'}
              </option>
            ))}
          </select>
        </div>
        {selectedListId && (
          <button onClick={() => setShowRuleForm(true)} className="btn-primary">
            + Ny Regel
          </button>
        )}
      </div>

      {/* Rule Form */}
      {showRuleForm && selectedListId && (
        <form onSubmit={handleCreateRule} className="bg-dark-800 p-4 rounded-lg mb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Varekode (valgfri)</label>
              <input
                type="text"
                value={ruleForm.varekode}
                onChange={(e) => setRuleForm({ ...ruleForm, varekode: e.target.value })}
                className="input w-full"
                placeholder="Spesifikk vare"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Varegruppe (valgfri)</label>
              <select
                value={ruleForm.varegruppe}
                onChange={(e) => setRuleForm({ ...ruleForm, varegruppe: e.target.value })}
                className="input w-full"
              >
                <option value="">Alle varegrupper</option>
                {productGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Min. antall</label>
              <input
                type="number"
                min="1"
                value={ruleForm.min_quantity}
                onChange={(e) => setRuleForm({ ...ruleForm, min_quantity: parseInt(e.target.value) || 1 })}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Kundegruppe (valgfri)</label>
              <select
                value={ruleForm.customer_group_id}
                onChange={(e) => setRuleForm({ ...ruleForm, customer_group_id: e.target.value })}
                className="input w-full"
              >
                <option value="">Alle kunder</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Rabattype</label>
              <select
                value={ruleForm.discount_type}
                onChange={(e) => setRuleForm({ ...ruleForm, discount_type: e.target.value as 'percent' | 'fixed' })}
                className="input w-full"
              >
                <option value="percent">Prosent rabatt</option>
                <option value="fixed">Fast pris</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">
                {ruleForm.discount_type === 'percent' ? 'Rabatt (%)' : 'Fast pris (NOK)'}
              </label>
              <input
                type="number"
                step="0.01"
                value={ruleForm.discount_type === 'percent' ? ruleForm.discount_percent : ruleForm.fixed_price}
                onChange={(e) => {
                  if (ruleForm.discount_type === 'percent') {
                    setRuleForm({ ...ruleForm, discount_percent: e.target.value });
                  } else {
                    setRuleForm({ ...ruleForm, fixed_price: e.target.value });
                  }
                }}
                className="input w-full"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Opprett</button>
            <button
              type="button"
              onClick={() => {
                setShowRuleForm(false);
                setRuleForm(INITIAL_RULE_FORM);
              }}
              className="btn-secondary"
            >
              Avbryt
            </button>
          </div>
        </form>
      )}

      {/* Rules List */}
      {selectedListId ? (
        rules.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-dark-700">
                  <th className="text-left py-3 px-4 text-dark-300 font-medium">Produkt</th>
                  <th className="text-left py-3 px-4 text-dark-300 font-medium">Kunde/Gruppe</th>
                  <th className="text-left py-3 px-4 text-dark-300 font-medium">Min. antall</th>
                  <th className="text-left py-3 px-4 text-dark-300 font-medium">Rabatt</th>
                  <th className="text-right py-3 px-4 text-dark-300 font-medium">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule) => (
                  <tr key={rule.id} className="border-b border-dark-800 hover:bg-dark-800/50">
                    <td className="py-3 px-4">
                      {rule.varekode || rule.varegruppe || <span className="text-dark-400">Alle produkter</span>}
                    </td>
                    <td className="py-3 px-4">
                      {rule.kundenr || rule.customer_group_name || <span className="text-dark-400">Alle kunder</span>}
                    </td>
                    <td className="py-3 px-4">{rule.min_quantity}</td>
                    <td className="py-3 px-4 font-medium text-green-400">
                      {rule.discount_percent !== null ? `-${rule.discount_percent}%` : `${rule.fixed_price} NOK`}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Slett
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-dark-400">
            Ingen regler i denne prislisten. Klikk "Ny Regel" for å legge til.
          </div>
        )
      ) : (
        <div className="text-center py-8 text-dark-400">
          Velg en prisliste for å se og administrere regler
        </div>
      )}
    </div>
  );
}
