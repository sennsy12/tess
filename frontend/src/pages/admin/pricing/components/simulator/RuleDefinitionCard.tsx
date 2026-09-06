import type { CustomerGroup, PriceList, SimulatorForm } from '../../../../../types/pricing';

interface RuleDefinitionCardProps {
  form: SimulatorForm;
  update: <K extends keyof SimulatorForm>(key: K, value: SimulatorForm[K]) => void;
  activeLists: PriceList[];
  groups: CustomerGroup[];
}

/** Left config panel: price list, product scope and customer target. */
export function RuleDefinitionCard({ form, update, activeLists, groups }: RuleDefinitionCardProps) {
  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold">Foreslatt regel</h3>

      {/* Price list */}
      <div>
        <label className="label">Prisliste</label>
        <select
          value={form.price_list_id}
          onChange={(e) => update('price_list_id', e.target.value)}
          className="input w-full"
        >
          <option value="">Velg prisliste...</option>
          {activeLists.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {/* Product scope */}
      <div>
        <label className="label">Produktomfang</label>
        <select
          value={form.scope}
          onChange={(e) => update('scope', e.target.value as SimulatorForm['scope'])}
          className="input w-full"
        >
          <option value="all">Alle produkter</option>
          <option value="product">Spesifikt produkt</option>
          <option value="category">Varegruppe</option>
        </select>
      </div>
      {form.scope === 'product' && (
        <input
          value={form.varekode}
          onChange={(e) => update('varekode', e.target.value.trim())}
          className="input w-full"
          placeholder="Varekode (f.eks. V001)"
          maxLength={50}
        />
      )}
      {form.scope === 'category' && (
        <input
          value={form.varegruppe}
          onChange={(e) => update('varegruppe', e.target.value.trim())}
          className="input w-full"
          placeholder="Varegruppe"
          maxLength={50}
        />
      )}

      {/* Customer target */}
      <div>
        <label className="label">Kundeomfang</label>
        <select
          value={form.target}
          onChange={(e) => update('target', e.target.value as SimulatorForm['target'])}
          className="input w-full"
        >
          <option value="all">Alle kunder</option>
          <option value="customer">Spesifikk kunde</option>
          <option value="group">Kundegruppe</option>
        </select>
      </div>
      {form.target === 'customer' && (
        <input
          value={form.kundenr}
          onChange={(e) => update('kundenr', e.target.value.trim())}
          className="input w-full"
          placeholder="Kundenr"
          maxLength={50}
        />
      )}
      {form.target === 'group' && (
        <select
          value={form.customer_group_id}
          onChange={(e) => update('customer_group_id', e.target.value)}
          className="input w-full"
        >
          <option value="">Velg gruppe...</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      )}

      {/* Min quantity */}
      <div>
        <label className="label">Min. antall</label>
        <input
          type="number"
          min={0}
          step={1}
          value={form.min_quantity}
          onChange={(e) => update('min_quantity', Number(e.target.value))}
          className="input w-full"
        />
        {(!Number.isInteger(form.min_quantity) || form.min_quantity < 0) && (
          <p className="mt-1 text-xs text-red-400">
            Min. antall må være et helt tall som er 0 eller høyere.
          </p>
        )}
      </div>
    </div>
  );
}
