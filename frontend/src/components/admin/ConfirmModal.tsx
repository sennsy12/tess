import { useId, type ReactNode } from 'react';
import { ModalShell } from '../ModalShell';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ConfirmModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the user dismisses (cancel or backdrop click) */
  onClose: () => void;
  /** Called when the user confirms */
  onConfirm: () => void;
  /** Modal title */
  title: string;
  /** Descriptive body content */
  children: ReactNode;
  /** Label for the confirm button (default "Slett") */
  confirmLabel?: string;
  /** Label for the cancel button (default "Avbryt") */
  cancelLabel?: string;
  /** Visual intent – controls confirm-button colour (default "danger") */
  intent?: 'danger' | 'primary';
  /** Whether the confirm action is in progress (disables buttons) */
  loading?: boolean;
  /** Max width class (default "max-w-sm") */
  maxWidth?: string;
  /** Allow backdrop-click + Escape dismissal (default true) */
  dismissable?: boolean;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

/**
 * Lightweight confirm/action modal used across admin pages.
 *
 * Backdrop, motion, Escape and focus handling come from `ModalShell`.
 *
 * @example
 * ```tsx
 * <ConfirmModal
 *   open={!!deleteTarget}
 *   onClose={() => setDeleteTarget(null)}
 *   onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
 *   title="Slett bruker"
 *   loading={deleteMutation.isPending}
 * >
 *   Er du sikker på at du vil slette <strong>{deleteTarget?.username}</strong>?
 * </ConfirmModal>
 * ```
 */
export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Slett',
  cancelLabel = 'Avbryt',
  intent = 'danger',
  loading = false,
  maxWidth = 'max-w-sm',
  dismissable = true,
}: ConfirmModalProps) {
  const titleId = useId();

  const confirmBtnClass = intent === 'danger' ? 'btn-danger' : 'btn-primary';

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      maxWidth={maxWidth}
      dismissable={dismissable}
    >
      <h3 id={titleId} className={`text-lg font-semibold ${intent === 'danger' ? 'text-red-400' : ''}`}>
        {title}
      </h3>

      <div className="text-dark-300 mt-2">{children}</div>

      <div className="flex justify-end gap-3 pt-4">
        <button onClick={onClose} className="btn-secondary">
          {cancelLabel}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`${confirmBtnClass} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? 'Venter...' : confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}
