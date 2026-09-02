import { useId, type ReactNode } from 'react';
import { ModalShell } from '../ModalShell';
import { Spinner } from '../Spinner';

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
 * Chrome, motion, Escape and focus handling come from `ModalShell`.
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
  const titleId = useId();

  return (
    <ModalShell open={open} onClose={onClose} labelledBy={titleId} maxWidth={maxWidth}>
      <h3 id={titleId} className="text-lg font-semibold mb-4">
        {title}
      </h3>

      <form onSubmit={onSubmit} className="space-y-4">
        {children}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Spinner size="xs" />
                Lagrer...
              </span>
            ) : (
              submitLabel
            )}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
