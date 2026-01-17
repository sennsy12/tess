import { useState } from 'react';
import { CustomerWithGroup, PriceCalculationResult } from '../types';
import { pricingApi } from '../../../../lib/api';

interface Props {
  customersWithGroups: CustomerWithGroup[];
}

export function PreviewTab({ customersWithGroups }: Props) {
  const [kundenr, setKundenr] = useState('');
  const [varekode, setVarekode] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isCalculating, setIsCalculating] = useState(false);
  const [result, setResult] = useState<PriceCalculationResult | null>(null);
  const [error, setError] = useState('');

  const handleCalculate = async () => {
    if (!kundenr || !varekode || !basePrice) {
      setError('Fyll inn alle feltene');
      return;
    }

    setIsCalculating(true);
    setError('');
    setResult(null);

    try {
      const response = await pricingApi.calculatePrice({
        varekode,
        kundenr,
        quantity,
        base_price: parseFloat(basePrice),
      });
      setResult(response.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Kunne ikke beregne pris');
    } finally {
      setIsCalculating(false);
    }
  };

  const selectedCustomer = customersWithGroups.find(c => c.kundenr === kundenr);

  return (
    <div className="space-y-6">
      {/* Input Form */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4">🔍 Test prisberegning</h3>
        <p className="text-dark-400 text-sm mb-6">
          Test hvordan priser beregnes for en kunde basert på prisregler og kundegrupper.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Customer Select */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Kunde
            </label>
            <select
              value={kundenr}
              onChange={(e) => setKundenr(e.target.value)}
              className="input w-full"
            >
              <option value="">Velg kunde...</option>
              {customersWithGroups.map((c) => (
                <option key={c.kundenr} value={c.kundenr}>
                  {c.kundenr} - {c.kundenavn}
                </option>
              ))}
            </select>
            {selectedCustomer?.customer_group_name && (
              <p className="text-xs text-primary-400 mt-1">
                Gruppe: {selectedCustomer.customer_group_name}
              </p>
            )}
          </div>

          {/* Product Code */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Varekode
            </label>
            <input
              type="text"
              value={varekode}
              onChange={(e) => setVarekode(e.target.value)}
              placeholder="f.eks. ABC123"
              className="input w-full"
            />
          </div>

          {/* Base Price */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Basispris (kr)
            </label>
            <input
              type="number"
              value={basePrice}
              onChange={(e) => setBasePrice(e.target.value)}
              placeholder="100"
              min="0"
              step="0.01"
              className="input w-full"
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-1">
              Antall: {quantity}
            </label>
            <input
              type="range"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value))}
              min="1"
              max="100"
              className="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>

        <button
          onClick={handleCalculate}
          disabled={isCalculating}
          className="btn btn-primary mt-6"
        >
          {isCalculating ? 'Beregner...' : '🧮 Beregn pris'}
        </button>

        {error && (
          <div className="mt-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}
      </div>

      {/* Results */}
      {result && (
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">📊 Resultat</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Original Price */}
            <div className="bg-dark-800 rounded-lg p-4 text-center">
              <p className="text-sm text-dark-400 mb-1">Originalpris</p>
              <p className="text-2xl font-bold text-dark-300">
                {result.original_price.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
              </p>
              <p className="text-xs text-dark-500 mt-1">
                {quantity} stk × {parseFloat(basePrice).toFixed(2)} kr
              </p>
            </div>

            {/* Final Price */}
            <div className={`rounded-lg p-4 text-center ${
              result.discount_applied 
                ? 'bg-green-500/20 border border-green-500/50' 
                : 'bg-dark-800'
            }`}>
              <p className="text-sm text-dark-400 mb-1">Kundepris</p>
              <p className={`text-2xl font-bold ${
                result.discount_applied ? 'text-green-400' : 'text-white'
              }`}>
                {result.final_price.toLocaleString('no-NO', { minimumFractionDigits: 2 })} kr
              </p>
              {result.discount_applied && (
                <p className="text-xs text-green-400 mt-1">
                  Enhetspris: {result.unit_price.toFixed(2)} kr
                </p>
              )}
            </div>

            {/* Discount Info */}
            <div className="bg-dark-800 rounded-lg p-4 text-center">
              <p className="text-sm text-dark-400 mb-1">Rabatt</p>
              {result.discount_applied ? (
                <>
                  <p className="text-2xl font-bold text-yellow-400">
                    -{result.discount_percent}%
                  </p>
                  <p className="text-xs text-yellow-400/70 mt-1">
                    Du sparer {result.discount_amount.toFixed(2)} kr
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-dark-500">
                  Ingen
                </p>
              )}
            </div>
          </div>

          {/* Applied Rule Details */}
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
                ℹ️ Ingen prisregler matcher for denne kombinasjonen av kunde, produkt og antall.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
