import type { ReactNode } from 'react';

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
  /** Whether the confirm action is in progress (shows spinner, disables button) */
  loading?: boolean;
  /** Max width class (default "max-w-sm") */
  maxWidth?: string;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

/**
 * Lightweight confirm/action modal used across admin pages.
 *
 * Keeps focus-trap simple: clicking the backdrop or cancel closes.
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
}: ConfirmModalProps) {
  if (!open) return null;

  const confirmBtnClass =
    intent === 'danger'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-primary-600 hover:bg-primary-700 text-white';

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-dark-900 border border-dark-700 rounded-xl w-full ${maxWidth} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-4">
          <h3
            className={`text-lg font-semibold ${intent === 'danger' ? 'text-red-400' : ''}`}
          >
            {title}
          </h3>

          <div className="text-dark-300">{children}</div>

          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="btn-secondary">
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${confirmBtnClass}`}
            >
              {loading ? 'Venter...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
