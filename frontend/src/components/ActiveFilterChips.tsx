import { X } from 'lucide-react';

export interface FilterChip {
  id: string;
  label: string;
}

interface ActiveFilterChipsProps {
  chips: FilterChip[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
}

export function ActiveFilterChips({ chips, onRemove, onClearAll }: ActiveFilterChipsProps) {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="list" aria-label="Aktive filtre">
      <span className="text-xs text-dark-500 uppercase tracking-wide font-medium">Filtre:</span>
      {chips.map((chip) => (
        <span
          key={chip.id}
          role="listitem"
          className="inline-flex items-center gap-1 rounded-full bg-primary-600/20 border border-primary-600/30 px-3 py-1 text-xs text-primary-200"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.id)}
            className="ml-0.5 rounded-full hover:bg-primary-600/30 p-0.5 text-primary-300"
            aria-label={`Fjern filter ${chip.label}`}
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </span>
      ))}
      {onClearAll && chips.length > 1 && (
        <button type="button" onClick={onClearAll} className="text-xs text-dark-400 hover:text-dark-200">
          Nullstill alle
        </button>
      )}
    </div>
  );
}
