import type { ReactNode } from 'react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface FormModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the user dismisses (cancel or backdrop click) */
  onClose: () => void;
  /** Called on form submission */
  onSubmit: (e: React.FormEvent) => void;
  /** Modal title */
  title: string;
  /** Form body content (field inputs) */
  children: ReactNode;
  /** Label for the submit button (default "Lagre") */
  submitLabel?: string;
  /** Label for the cancel button (default "Avbryt") */
  cancelLabel?: string;
  /** Whether the submit action is in progress */
  loading?: boolean;
  /** Max width class (default "max-w-md") */
  maxWidth?: string;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

/**
 * Generic form-in-a-modal shell used for create/edit operations.
 *
 * Takes care of the backdrop, card chrome, and footer buttons while
 * letting the consumer own the form fields via `children`.
 *
 * @example
 * ```tsx
 * <FormModal
 *   open={modalMode !== null}
 *   onClose={closeModal}
 *   onSubmit={handleSubmit}
 *   title={isEdit ? 'Rediger bruker' : 'Opprett ny bruker'}
 *   submitLabel={isEdit ? 'Lagre' : 'Opprett'}
 *   loading={isSaving}
 * >
 *   <FieldGroup label="Brukernavn">
 *     <input ... />
 *   </FieldGroup>
 * </FormModal>
 * ```
 */
export function FormModal({
  open,
  onClose,
  onSubmit,
  title,
  children,
  submitLabel = 'Lagre',
  cancelLabel = 'Avbryt',
  loading = false,
  maxWidth = 'max-w-md',
}: FormModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className={`bg-dark-900 border border-dark-700 rounded-xl w-full ${maxWidth} shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-800">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        {/* Form body */}
        <form onSubmit={onSubmit} className="p-6 space-y-4">
          {children}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              {cancelLabel}
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  Lagrer...
                </span>
              ) : (
                submitLabel
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
