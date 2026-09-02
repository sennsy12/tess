import type { Transition, Variants } from 'framer-motion';

/**
 * Phase 2 — shared dialog motion (additive).
 *
 * Previously every modal/drawer hardcoded its own `initial/animate/exit`.
 * Shells (`ModalShell`, `DrawerShell`) use these; one-off dialogs
 * (bottom sheets) keep their local motion until they migrate.
 */

/** Centered modal panel: subtle scale + fade. */
export const dialogPanelVariants: Variants = {
  hidden: { scale: 0.95, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
  exit: { scale: 0.95, opacity: 0 },
};

/** Backdrop fade. */
export const dialogBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

/** Right-edge drawer (matches the historic CartDrawer feel). */
export const rightDrawerVariants: Variants = {
  hidden: { x: '100%' },
  visible: { x: 0 },
  exit: { x: '100%' },
};

/** Spring shared by drawers and bottom sheets. */
export const dialogSpring: Transition = {
  type: 'spring',
  damping: 30,
  stiffness: 300,
};
