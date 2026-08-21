import { FormEvent, useMemo, useState } from 'react';
import { getApiError } from '../../../../lib/apiErrors';
import { useMutation } from '@tanstack/react-query';
import { AutocompleteInput } from '../../../../components/AutocompleteInput';
import { parseNorwegianNumber } from '../../../../lib/formatters';
import { pricingApi } from '../../../../lib/api';
import { PriceCalculationResult, PreviewTabProps } from '../../../../types/pricing';

export function PreviewTab({ customersWithGroups }: PreviewTabProps) {
  const [kundenr, setKundenr] = useState('');
  const [varekode, setVarekode] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [result, setResult] = useState<PriceCalculationResult | null>(null);
  const [error, setError] = useState('');

  const calc = useMutation({
    mutationFn: pricingApi.calculatePrice,
    onSuccess: (response) => {
      setResult(response.data);
      setError('');
    },
    onError: (err: unknown) => {
      setError(getApiError(err, 'Kunne ikke beregne pris'));
      setResult(null);
    },
  });

  const selectedCustomer = useMemo(
    () => customersWithGroups.find((c) => c.kundenr === kundenr),
    [customersWithGroups, kundenr],
  );

  const parsedBasePrice = (() => {
    const n = parseNorwegianNumber(basePrice);
    return n !== null && n > 0 ? n : null;
  })();
  const canSubmit = Boolean(kundenr && varekode.trim() && parsedBasePrice);

  const handleCalculate = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !parsedBasePrice) {
      setError('Fyll inn alle feltene med gyldige verdier');
      return;
    }
    calc.mutate({
      varekode: varekode.trim(),
      kundenr,
      quantity,
      base_price: parsedBasePrice,
    });
  };

  const fetchCustomerSuggestions = async (query: string) => {
    const lower = query.toLowerCase();
    return customersWithGroups
      .filter(
        (c) =>
          c.kundenr.toLowerCase().includes(lower) ||
          (c.kundenavn?.toLowerCase().includes(lower) ?? false),
      )
      .slice(0, 25)
      .map((c) => ({
        suggestion: `${c.kundenr} - ${c.kundenavn ?? ''}`.trim(),
        type: 'kunde',
      }));
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">Test prisberegning</h3>
        <p className="text-dark-400 text-sm mb-6">
          Test hvordan priser beregnes for en kunde basert på prisregler og kundegrupper.
        </p>

        <form onSubmit={handleCalculate}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="preview-kundenr" className="block text-sm font-medium text-dark-300 mb-1">
                Kunde
              </label>
              <AutocompleteInput
                id="preview-kundenr"
                value={kundenr}
                onChange={(val) => {
                  setKundenr(val.split(' - ')[0]?.trim() ?? val);
                  setError('');
                }}
                fetchSuggestions={fetchCustomerSuggestions}
                onSelect={(suggestion) => {
                  setKundenr(suggestion.suggestion.split(' - ')[0]?.trim() ?? '');
                  setError('');
                }}
                placeholder="Søk kundenr eller navn..."
                minChars={1}
              />
              {selectedCustomer?.customer_group_name && (
                <p className="text-xs text-primary-400 mt-1">
                  Gruppe: {selectedCustomer.customer_group_name}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="preview-varekode" className="block text-sm font-medium text-dark-300 mb-1">
                Varekode
              </label>
              <input
                id="preview-varekode"
                type="text"
                value={varekode}
                onChange={(e) => {
                  setVarekode(e.target.value);
                  setError('');
                }}
                placeholder="f.eks. ABC123"
                className="input w-full"
              />
            </div>

            <div>
              <label htmlFor="preview-base-price" className="block text-sm font-medium text-dark-300 mb-1">
                Basispris (kr)
              </label>
              <input
                id="preview-base-price"
                type="number"
                value={basePrice}
                onChange={(e) => {
                  setBasePrice(e.target.value);
                  setError('');
                }}
                placeholder="100"
                min="0"
                step="0.01"
                className="input w-full"
              />
            </div>

            <div>
              <label htmlFor="preview-quantity" className="block text-sm font-medium text-dark-300 mb-1">
                Antall: {quantity}
              </label>
              <input
                id="preview-quantity"
                type="range"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
                min="1"
                max="100"
                className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!canSubmit || calc.isPending}
            className="btn btn-primary mt-6"
          >
            {calc.isPending ? 'Beregner...' : 'Beregn pris'}
          </button>

          {error && (
            <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}
        </form>
      </div>

      {result && parsedBasePrice && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Resultat</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-dark-800 rounded-lg p-4 text-center">
              <p className="text-sm text-dark-400 mb-1">Originalpris</p>
              <p className="text-2xl font-bold text-dark-300">
                {result.original_price.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
              </p>
              <p className="text-xs text-dark-500 mt-1">
                {quantity} stk × {parsedBasePrice.toFixed(2)} kr
              </p>
            </div>

            <div
              className={`rounded-lg p-4 text-center ${
                result.discount_applied
                  ? 'bg-green-500/20 border border-green-500/50'
                  : 'bg-dark-800'
              }`}
            >
              <p className="text-sm text-dark-400 mb-1">Kundepris</p>
              <p
                className={`text-2xl font-bold ${
                  result.discount_applied ? 'text-green-400' : 'text-white'
                }`}
              >
                {result.final_price.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
              </p>
              {result.discount_applied && (
                <p className="text-xs text-green-400 mt-1">
                  Enhetspris: {result.unit_price.toFixed(2)} kr
                </p>
              )}
            </div>

            <div className="bg-dark-800 rounded-lg p-4 text-center">
              <p className="text-sm text-dark-400 mb-1">Rabatt</p>
              {result.discount_applied ? (
                <>
                  <p className="text-2xl font-bold text-yellow-400">-{result.discount_percent}%</p>
                  <p className="text-xs text-yellow-400/70 mt-1">
                    Du sparer {result.discount_amount.toFixed(2)} kr
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-dark-500">Ingen</p>
              )}
            </div>
          </div>

          {result.discount_applied && result.applied_rule_name && (
            <div className="mt-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg">
              <p className="text-sm text-primary-300">
                <span className="font-semibold">Aktiv regel:</span> {result.applied_rule_name}
              </p>
              {result.applied_list_name && (
                <p className="text-sm text-primary-300/70 mt-1">
                  <span className="font-semibold">Fra prisliste:</span> {result.applied_list_name}
                </p>
              )}
            </div>
          )}

          {!result.discount_applied && (
            <div className="mt-6 p-4 bg-dark-800 border border-dark-700 rounded-lg">
              <p className="text-sm text-dark-400">
                Ingen prisregler matcher for denne kombinasjonen av kunde, produkt og antall.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
