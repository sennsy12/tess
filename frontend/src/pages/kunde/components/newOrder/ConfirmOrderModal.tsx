import { Send } from 'lucide-react';
import { useCart } from '../../../../context/useCart';
import { formatMoneyNok } from '../../../../lib/formatters';
import { ModalShell } from '../../../../components/ModalShell';
import { Spinner } from '../../../../components/Spinner';

interface ConfirmOrderModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  kundeordreref: string;
  onKundeordrerefChange: (value: string) => void;
  kunderef: string;
  onKunderefChange: (value: string) => void;
}

/**
 * Final review dialog before submitting the cart as an order. Shows the
 * line list with per-line amounts and optional customer references.
 * Backdrop clicks are ignored while a submission is in flight.
 */
export function ConfirmOrderModal({
  open,
  onClose,
  onConfirm,
  isSubmitting,
  kundeordreref,
  onKundeordrerefChange,
  kunderef,
  onKunderefChange,
}: ConfirmOrderModalProps) {
  const cart = useCart();

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      label="Bekreft bestilling"
      maxWidth="max-w-lg"
      dismissable={!isSubmitting}
      className="max-h-[90vh] overflow-y-auto"
    >
      <h3 className="text-xl font-semibold mb-1">Bekreft bestilling</h3>
      <p className="text-sm text-dark-400 mb-4">
        {cart.items.length} linjer · Totalt{' '}
        <span className="text-green-400 font-semibold">{formatMoneyNok(cart.total)}</span>.
        Ordren sendes til godkjenning før den behandles.
      </p>

      <div className="space-y-3 mb-4 max-h-48 overflow-y-auto border border-dark-800 rounded-lg p-3">
        {cart.items.map((item) => (
          <div key={item.varekode} className="flex justify-between text-sm">
            <span className="truncate mr-2">
              {item.antall} × {item.varenavn || item.varekode}
            </span>
            <span className="font-medium whitespace-nowrap">
              {formatMoneyNok(item.unit_price * item.antall)}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
        <div>
          <label className="label" htmlFor="kundeordreref">
            Deres ordrenr / referanse
          </label>
          <input
            id="kundeordreref"
            className="input w-full"
            value={kundeordreref}
            onChange={(e) => onKundeordrerefChange(e.target.value)}
            maxLength={100}
            placeholder="Valgfritt"
          />
        </div>
        <div>
          <label className="label" htmlFor="kunderef">
            Referanse
          </label>
          <input
            id="kunderef"
            className="input w-full"
            value={kunderef}
            onChange={(e) => onKunderefChange(e.target.value)}
            maxLength={100}
            placeholder="Valgfritt"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          className="btn-secondary"
          disabled={isSubmitting}
          onClick={onClose}
        >
          Avbryt
        </button>
        <button
          type="button"
          className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isSubmitting}
          onClick={onConfirm}
        >
          {isSubmitting ? (
            <Spinner size="xs" />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {isSubmitting ? 'Sender…' : 'Send bestilling'}
        </button>
      </div>
    </ModalShell>
  );
}
