import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import { dialogBackdropVariants, dialogPanelVariants } from './motion';

interface ModalShellProps {
  open: boolean;
  /** Called on backdrop click / Escape when `dismissable` (default true). */
  onClose: () => void;
  /** Id of the title element inside (preferred accessible name). */
  labelledBy?: string;
  /** Fallback accessible name when there is no labelledBy target. */
  label?: string;
  describedBy?: string;
  role?: 'dialog' | 'alertdialog';
  /** Max-width class for the panel (default "max-w-md"). */
  maxWidth?: string;
  /** Stacking layer (default "z-[70]"). Pass-through for above-modal cases. */
  zIndex?: string;
  /** Centered modal (default) or top-anchored palette (GlobalSearch). */
  align?: 'center' | 'top';
  /** Allow backdrop-click + Escape dismissal (default true). */
  dismissable?: boolean;
  children: ReactNode;
  /** Extra panel classes (e.g. `max-h-[90vh] overflow-y-auto`). */
  className?: string;
}

/**
 * Single chrome for all centered modals: backdrop, `.card` panel,
 * scale+fade motion, Escape handling, focus trap + focus return.
 *
 * Unifies `FormModal`/`ConfirmModal` (static, no a11y), `ConfirmOrderModal`
 * / cancel dialogs (`z-[60]`, ad-hoc motion), `KundeOnboarding` (`z-[150]`),
 * `IdleTimer` (`z-[100]`, alertdialog) and `GlobalSearch` (`z-[200]`, top).
 */
export function ModalShell({
  open,
  onClose,
  labelledBy,
  label,
  describedBy,
  role = 'dialog',
  maxWidth = 'max-w-md',
  zIndex = 'z-[70]',
  align = 'center',
  dismissable = true,
  children,
  className = '',
}: ModalShellProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  useDialogFocusTrap(open, panelRef);

  useEffect(() => {
    if (!open || !dismissable) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, dismissable, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 ${zIndex} flex p-4 ${
            align === 'top'
              ? 'items-start justify-center pt-[10vh] sm:pt-[12vh]'
              : 'items-center justify-center'
          }`}
        >
          <motion.div
            variants={dialogBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={dismissable ? onClose : undefined}
            role="presentation"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role={role}
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : label}
            aria-describedby={describedBy}
            variants={dialogPanelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.2 }}
            className={`relative card w-full ${maxWidth} ${className}`}
          >
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
