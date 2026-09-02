import { ShoppingCart, Trash2, Send } from 'lucide-react';
import { useCart } from '../../../../context/useCart';
import { formatMoneyNok } from '../../../../lib/formatters';

interface CartPanelProps {
  onCheckout: () => void;
}

/** Cart line list + totals. Shared by the desktop sidebar and mobile drawer. */
export function CartPanel({ onCheckout }: CartPanelProps) {
  const cart = useCart();

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary-400" aria-hidden />
          Handlekurv
        </h3>
        {cart.items.length > 0 && (
          <button
            type="button"
            onClick={cart.clear}
            className="text-xs text-dark-400 hover:text-red-400 transition-colors"
          >
            Tøm
          </button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingCart className="h-10 w-10 mx-auto text-dark-700 mb-2" aria-hidden />
          <p className="text-dark-400 text-sm">Handlekurven er tom.</p>
          <p className="text-dark-500 text-xs mt-1">Legg til produkter fra katalogen.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-2 mb-4 max-h-72 overflow-y-auto pr-1">
            {cart.items.map((item) => (
              <li key={item.varekode} className="flex items-center gap-2 bg-dark-800/50 rounded-lg p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{item.varenavn || item.varekode}</p>
                  <p className="text-xs text-dark-400 font-mono">{item.varekode}</p>
                </div>
                <input
                  type="number"
                  min={1}
                  value={item.antall}
                  onChange={(e) => cart.setQuantity(item.varekode, parseInt(e.target.value, 10) || 0)}
                  className="w-16 input text-sm text-center px-1 py-1"
                  aria-label={`Antall for ${item.varekode}`}
                />
                <span className="text-sm font-semibold w-20 text-right whitespace-nowrap">
                  {formatMoneyNok(item.unit_price * item.antall)}
                </span>
                <button
                  type="button"
                  onClick={() => cart.removeItem(item.varekode)}
                  className="p-1.5 rounded text-dark-500 hover:text-red-400 hover:bg-dark-800"
                  aria-label={`Fjern ${item.varekode}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>

          <div className="border-t border-dark-800 pt-3 space-y-1 text-sm mb-4">
            <div className="flex justify-between text-dark-400">
              <span>Linjer</span>
              <span>{cart.items.length}</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>Totalt (eks. mva)</span>
              <span className="text-green-400">{formatMoneyNok(cart.total)}</span>
            </div>
          </div>

          <button type="button" className="btn-primary w-full flex items-center justify-center gap-2" onClick={onCheckout}>
            <Send className="h-4 w-4" aria-hidden />
            Til bekreftelse
          </button>
        </>
      )}
    </div>
  );
}
