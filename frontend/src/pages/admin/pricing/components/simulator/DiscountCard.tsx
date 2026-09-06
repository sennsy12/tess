import type { CustomerGroup, SimulatorForm } from '../../../../../types/pricing';

interface DiscountCardProps {
  form: SimulatorForm;
  update: <K extends keyof SimulatorForm>(key: K, value: SimulatorForm[K]) => void;
  groups: CustomerGroup[];
}

/** Centre config panel: discount type/value and a plain-text rule summary. */
export function DiscountCard({ form, update, groups }: DiscountCardProps) {
  const percentRaw = (form.discount_percent ?? '').trim();
  const percentNum = percentRaw === '' ? NaN : Number(percentRaw);
  const percentError =
    form.discount_type !== 'percent'
      ? null
      : percentRaw === ''
        ? 'Rabatt (%) er påkrevd.'
        : !Number.isFinite(percentNum)
          ? 'Rabatt (%) må være et tall.'
          : percentNum < 0 || percentNum > 100
            ? 'Rabatt (%) må være mellom 0 og 100.'
            : null;

  const fixedRaw = (form.fixed_price ?? '').trim();
  const fixedNum = fixedRaw === '' ? NaN : Number(fixedRaw);
  const fixedError =
    form.discount_type !== 'fixed'
      ? null
      : fixedRaw === ''
        ? 'Fast pris er påkrevd.'
        : !Number.isFinite(fixedNum)
          ? 'Fast pris må være et tall.'
          : fixedNum < 0
            ? 'Fast pris kan ikke være negativ.'
            : null;
  return (
    <div className="card space-y-4">
      <h3 className="text-lg font-semibold">Rabatt / pris</h3>

      <div>
        <label className="label">Type</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => update('discount_type', 'percent')}
            className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
              form.discount_type === 'percent'
                ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                : 'border-dark-600 text-dark-400 hover:bg-dark-800'
            }`}
          >
            % Rabatt
          </button>
          <button
            type="button"
            onClick={() => update('discount_type', 'fixed')}
            className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
              form.discount_type === 'fixed'
                ? 'bg-primary-500/20 border-primary-500 text-primary-400'
                : 'border-dark-600 text-dark-400 hover:bg-dark-800'
            }`}
          >
            Fast pris
          </button>
        </div>
      </div>

      {form.discount_type === 'percent' ? (
        <div>
          <label className="label">Rabatt (%)</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={form.discount_percent}
            onChange={(e) => update('discount_percent', e.target.value)}
            className="input w-full"
            placeholder="f.eks. 15"
          />
          {percentError && <p className="text-xs text-red-400 mt-1">{percentError}</p>}
        </div>
      ) : (
        <div>
          <label className="label">Fast pris (NOK)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={form.fixed_price}
            onChange={(e) => update('fixed_price', e.target.value)}
            className="input w-full"
            placeholder="f.eks. 249.00"
          />
          {fixedError && <p className="text-xs text-red-400 mt-1">{fixedError}</p>}
        </div>
      )}

      {/* Visual summary */}
      <div className="bg-dark-800/60 rounded-lg p-4 mt-2">
        <p className="text-xs text-dark-400 uppercase tracking-wide mb-2">Regelsammendrag</p>
        <p className="text-sm text-dark-200">
          {form.discount_type === 'percent' && form.discount_percent
            ? `${form.discount_percent}% rabatt`
            : form.discount_type === 'fixed' && form.fixed_price
              ? `Fast pris ${form.fixed_price} NOK`
              : 'Konfigurer rabatt...'}
          {form.scope === 'product' && form.varekode ? ` for ${form.varekode}` : ''}
          {form.scope === 'category' && form.varegruppe ? ` for ${form.varegruppe}` : ''}
          {form.target === 'customer' && form.kundenr ? ` til kunde ${form.kundenr}` : ''}
          {form.target === 'group' && form.customer_group_id
            ? ` til ${groups.find((g) => g.id === Number(form.customer_group_id))?.name ?? 'gruppe'}`
            : ''}
          {form.min_quantity > 0 ? ` ved ${form.min_quantity}+ stk` : ''}
        </p>
      </div>
    </div>
  );
}
