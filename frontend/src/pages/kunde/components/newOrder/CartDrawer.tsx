import { X } from 'lucide-react';
import { CartPanel } from './CartPanel';
import { DrawerShell } from '../../../../components/DrawerShell';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

/** Slide-in cart drawer for small screens (backdrop + CartPanel). */
export function CartDrawer({ open, onClose, onCheckout }: CartDrawerProps) {
  return (
    <DrawerShell
      open={open}
      onClose={onClose}
      label="Handlekurv"
      className="xl:hidden"
      backdropClassName="xl:hidden"
    >
      <div className="flex items-center justify-between p-4 border-b border-dark-800 sticky top-0 bg-dark-900">
        <h3 className="text-lg font-semibold">Handlekurv</h3>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-dark-800"
          aria-label="Lukk handlekurv"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <div className="p-4">
        <CartPanel onCheckout={onCheckout} />
      </div>
    </DrawerShell>
  );
}
