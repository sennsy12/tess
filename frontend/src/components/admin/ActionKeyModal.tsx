import { useEffect, useState } from 'react';
import { FormModal } from './FormModal';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface ActionKeyModalProps {
  /** Whether the modal is visible */
  open: boolean;
  /** Called when the user dismisses (cancel or backdrop click) */
  onClose: () => void;
  /** Called when the user submits a valid action key */
  onConfirm: (actionKey: string) => void;
  /** Modal title */
  title: string;
  /** Optional descriptive copy shown above the input */
  description?: string;
  /** Label for the confirm button (default "Bekreft") */
  confirmLabel?: string;
  /** Label for the cancel button (default "Avbryt") */
  cancelLabel?: string;
  /** Whether the confirm action is in progress */
  loading?: boolean;
  /** Max width class (default "max-w-sm") */
  maxWidth?: string;
  /** Label for the action key input */
  inputLabel?: string;
  /** Placeholder for the action key input */
  placeholder?: string;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function ActionKeyModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Bekreft',
  cancelLabel = 'Avbryt',
  loading = false,
  maxWidth = 'max-w-sm',
  inputLabel = 'Sikkerhetskode',
  placeholder = '••••••••',
}: ActionKeyModalProps) {
  const [actionKey, setActionKey] = useState('');

  useEffect(() => {
    if (open) setActionKey('');
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = actionKey.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  if (!open) return null;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit}
      title={title}
      submitLabel={confirmLabel}
      cancelLabel={cancelLabel}
      loading={loading}
      maxWidth={maxWidth}
    >
      {description && <p className="text-sm text-dark-300">{description}</p>}
      <div>
        <label className="block text-sm font-medium text-dark-300 mb-1">
          {inputLabel}
        </label>
        <input
          type="password"
          value={actionKey}
          onChange={(e) => setActionKey(e.target.value)}
          className="input w-full"
          placeholder={placeholder}
          autoFocus
          required
        />
      </div>
    </FormModal>
  );
}
