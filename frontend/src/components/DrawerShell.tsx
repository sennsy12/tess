import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap';
import {
  dialogBackdropVariants,
  dialogSpring,
  rightDrawerVariants,
} from './motion';

interface DrawerShellProps {
  open: boolean;
  /** Called on backdrop click / Escape when `dismissable` (default true). */
  onClose: () => void;
  /** Accessible name for the drawer. */
  label: string;
  /** Max-width class (default "max-w-md"). */
  maxWidth?: string;
  zIndex?: string;
  dismissable?: boolean;
  children: ReactNode;
  /** Extra panel classes (e.g. responsive visibility). */
  className?: string;
  /** Extra backdrop classes (e.g. matching responsive visibility). */
  backdropClassName?: string;
}

/**
 * Single chrome for right-edge drawers: backdrop, spring slide-in,
 * Escape handling, focus trap + focus return. Unifies `CartDrawer`
 * (which had no Escape / focus handling).
 */
export function DrawerShell({
  open,
  onClose,
  label,
  maxWidth = 'max-w-md',
  zIndex = 'z-[70]',
  dismissable = true,
  children,
  className = '',
  backdropClassName = '',
}: DrawerShellProps) {
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
        <>
          <motion.div
            variants={dialogBackdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className={`fixed inset-0 bg-black/60 backdrop-blur-sm ${zIndex} ${backdropClassName}`}
            onClick={dismissable ? onClose : undefined}
            role="presentation"
          />
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            variants={rightDrawerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={dialogSpring}
            className={`fixed right-0 top-0 bottom-0 w-full ${maxWidth} bg-dark-900 border-l border-dark-800 overflow-y-auto ${zIndex} ${className}`}
          >
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
