import { useState } from 'react';
import toast from 'react-hot-toast';
import { pricingApi } from '../../../../lib/api';
import { PriceRule, RuleConflict, INITIAL_RULE_FORM, RulesTabProps, RuleFormData } from '../../../../types/pricing';

export function validateRuleForm(ruleForm: RuleFormData): string | null {
  if (!Number.isInteger(ruleForm.min_quantity) || ruleForm.min_quantity < 0) {
    return 'Min. antall må være et helt tall som er 0 eller høyere.';
  }
  if (ruleForm.varekode && ruleForm.varekode.length > 50) {
    return 'Varekode kan være maks 50 tegn.';
  }
  if (ruleForm.varegruppe && ruleForm.varegruppe.length > 50) {
    return 'Varegruppe kan være maks 50 tegn.';
  }
  if (ruleForm.kundenr && ruleForm.kundenr.length > 50) {
    return 'Kundenr kan være maks 50 tegn.';
  }
  if (ruleForm.customer_group_id) {
    const id = Number(ruleForm.customer_group_id);
    if (!Number.isInteger(id) || id <= 0) {
      return 'Ugyldig kundegruppe.';
    }
  }
  if (ruleForm.discount_type === 'percent') {
    if (ruleForm.discount_percent === '' || ruleForm.discount_percent == null) {
      return 'Rabatt (%) er påkrevd.';
    }
    const n = Number(ruleForm.discount_percent);
    if (!Number.isFinite(n)) {
      return 'Rabatt (%) må være et tall.';
    }
    if (n < 0 || n > 100) {
      return 'Rabatt (%) må være mellom 0 og 100.';
    }
  } else {
    if (ruleForm.fixed_price === '' || ruleForm.fixed_price == null) {
      return 'Fast pris er påkrevd.';
    }
    const n = Number(ruleForm.fixed_price);
    if (!Number.isFinite(n)) {
      return 'Fast pris må være et tall.';
    }
    if (n < 0) {
      return 'Fast pris kan ikke være negativ.';
    }
  }
  return null;
}

export function RulesTab({
  rules,
  lists,
  groups,
  productGroups,
  selectedListId,
  showRuleForm,
  ruleForm,
  editingRule,
  setShowRuleForm,
  setRuleForm,
  setEditingRule,
  loadRules,
  handleCreateRule,
  handleUpdateRule,
  handleDeleteRule,
}: RulesTabProps) {
  const [conflicts, setConflicts] = useState<RuleConflict[]>([]);
  const [showConflictWarning, setShowConflictWarning] = useState(false);
  const [pendingSubmitEvent, setPendingSubmitEvent] = useState<React.FormEvent | null>(null);
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false);

  const handleEdit = (rule: PriceRule) => {
    setEditingRule(rule);
    setConflicts([]);
    setShowConflictWarning(false);
    setRuleForm({
      price_list_id: rule.price_list_id,
      varekode: rule.varekode || '',
      varegruppe: rule.varegruppe || '',
      kundenr: rule.kundenr || '',
      customer_group_id: rule.customer_group_id?.toString() || '',
      min_quantity: rule.min_quantity,
      discount_type: rule.discount_percent !== null ? 'percent' : rule.fixed_price !== null ? 'fixed' : 'percent',
      discount_percent: rule.discount_percent?.toString() || '',
      fixed_price: rule.fixed_price?.toString() || '',
    });
    setShowRuleForm(true);
  };

  const handleCancel = () => {
    setShowRuleForm(false);
    setEditingRule(null);
    setRuleForm(INITIAL_RULE_FORM);
    setConflicts([]);
    setShowConflictWarning(false);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedListId) return;

    const validationError = validateRuleForm(ruleForm);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setIsCheckingConflicts(true);
    try {
      const checkData = {
        price_list_id: selectedListId,
        varekode: ruleForm.varekode || null,
        varegruppe: ruleForm.varegruppe || null,
        kundenr: ruleForm.kundenr || null,
        customer_group_id: ruleForm.customer_group_id ? parseInt(ruleForm.customer_group_id) : null,
        min_quantity: ruleForm.min_quantity,
        exclude_rule_id: editingRule?.id,
      };

      const res = await pricingApi.checkRuleConflicts(checkData);
      const foundConflicts: RuleConflict[] = res.data;

      if (foundConflicts.length > 0) {
        setConflicts(foundConflicts);
        setShowConflictWarning(true);
        setPendingSubmitEvent(e);
        return;
      }
    } catch {
      // If conflict check fails, proceed anyway
    } finally {
      setIsCheckingConflicts(false);
    }

    // No conflicts, proceed directly
    if (editingRule) {
      handleUpdateRule(e);
    } else {
      handleCreateRule(e);
    }
  };

  const handleConfirmSave = () => {
    if (!pendingSubmitEvent) return;
    setShowConflictWarning(false);
    setConflicts([]);
    if (editingRule) {
      handleUpdateRule(pendingSubmitEvent);
    } else {
      handleCreateRule(pendingSubmitEvent);
    }
    setPendingSubmitEvent(null);
  };

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
        {selectedListId && !showRuleForm && (
          <button onClick={() => { setConflicts([]); setShowConflictWarning(false); setShowRuleForm(true); }} className="btn-primary">
            + Ny Regel
          </button>
        )}
      </div>

      {/* Rule Form (create or edit) */}
      {showRuleForm && selectedListId && (
        <form onSubmit={handleFormSubmit} className="bg-dark-800 p-4 rounded-lg mb-4 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-medium text-dark-200">
              {editingRule ? 'Rediger regel' : 'Ny regel'}
            </h4>
            {editingRule && (
              <span className="text-xs bg-primary-600/30 text-primary-300 px-2 py-0.5 rounded">
                ID: {editingRule.id}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Varekode (valgfri)</label>
              <input
                type="text"
                value={ruleForm.varekode}
                onChange={(e) => setRuleForm({ ...ruleForm, varekode: e.target.value })}
                className="input w-full"
                placeholder="Spesifikk vare"
                maxLength={50}
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
              <label className="block text-sm font-medium text-dark-300 mb-1">Kundenr (valgfri)</label>
              <input
                type="text"
                value={ruleForm.kundenr}
                onChange={(e) => setRuleForm({ ...ruleForm, kundenr: e.target.value })}
                className="input w-full"
                placeholder="Spesifikk kunde"
                maxLength={50}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-1">Min. antall</label>
              <input
                type="number"
                min="0"
                step="1"
                value={ruleForm.min_quantity}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setRuleForm({ ...ruleForm, min_quantity: Number.isNaN(n) ? 0 : Math.max(0, Math.trunc(n)) });
                }}
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
                min="0"
                max={ruleForm.discount_type === 'percent' ? 100 : undefined}
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

          {/* Conflict warnings */}
          {showConflictWarning && conflicts.length > 0 && (
            <div className="space-y-2">
              {conflicts.map((c) => (
                <div
                  key={c.conflicting_rule_id}
                  className={`rounded-lg px-4 py-3 text-sm ${
                    c.severity === 'warning'
                      ? 'bg-yellow-500/15 border border-yellow-500/40 text-yellow-200'
                      : 'bg-blue-500/15 border border-blue-500/40 text-blue-200'
                  }`}
                >
                  <span className="font-medium">
                    {c.severity === 'warning' ? 'Advarsel' : 'Info'}:
                  </span>{' '}
                  {c.overlap_reason}
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleConfirmSave}
                  className="btn-primary"
                >
                  Lagre likevel
                </button>
                <button
                  type="button"
                  onClick={() => { setShowConflictWarning(false); setConflicts([]); }}
                  className="btn-secondary"
                >
                  Avbryt
                </button>
              </div>
            </div>
          )}

          {!showConflictWarning && (
            <div className="flex gap-2">
              <button type="submit" className="btn-primary" disabled={isCheckingConflicts}>
                {isCheckingConflicts ? 'Sjekker...' : editingRule ? 'Lagre endringer' : 'Opprett'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary"
              >
                Avbryt
              </button>
            </div>
          )}
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
                      {rule.discount_percent !== null ? `-${rule.discount_percent}%` : rule.fixed_price !== null ? `${rule.fixed_price} NOK` : 'Ugyldig'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => handleEdit(rule)}
                          className="text-primary-400 hover:text-primary-300"
                        >
                          Rediger
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="text-red-400 hover:text-red-300"
                        >
                          Slett
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-dark-400">
            <p>Ingen regler i denne prislisten ennå.</p>
            <p className="text-sm mt-2">Regler matcher produkter og kunder — f.eks. «10 % rabatt på varegruppe X for grossister».</p>
          </div>
        )
      ) : (
        <div className="text-center py-8 text-dark-400">
          {lists.length === 0 ? (
            <div className="space-y-2">
              <p>Du trenger minst én prisliste før du kan legge til regler.</p>
              <p className="text-sm">Gå til fanen <span className="text-primary-400">Prislister</span> og opprett en liste først.</p>
            </div>
          ) : (
            <p>Velg en prisliste for å se og administrere regler</p>
          )}
        </div>
      )}
    </div>
  );
}
