import { FormEvent, useState } from 'react';
import { Send } from 'lucide-react';

interface AssistantInputProps {
  onSend: (text: string) => void;
  disabled: boolean;
}

export function AssistantInput({ onSend, disabled }: AssistantInputProps) {
  const [draft, setDraft] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 border-t border-dark-700/80 p-3 bg-dark-900/80">
      <label htmlFor="assistant-input" className="sr-only">
        Skriv melding til assistenten
      </label>
      <input
        id="assistant-input"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        maxLength={2000}
        disabled={disabled}
        placeholder="Spør om TESS…"
        className="flex-1 min-w-0 rounded-lg bg-dark-800 border border-dark-600 px-3 py-2 text-sm text-dark-50 placeholder:text-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500/50 disabled:opacity-50"
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={disabled || !draft.trim()}
        className="btn-primary px-3 py-2 flex items-center justify-center disabled:opacity-50"
        aria-label="Send melding"
      >
        <Send className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
