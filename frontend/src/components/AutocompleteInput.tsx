import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Building2,
  ClipboardList,
  Folder,
  Link2,
  Package,
  Phone,
  Search,
  Tag,
  User,
  type LucideIcon,
} from 'lucide-react';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOnClickOutside } from '../hooks/useOnClickOutside';
import { Spinner } from './Spinner';

interface Suggestion {
  suggestion: string;
  type: string;
}

interface AutocompleteInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  fetchSuggestions: (query: string) => Promise<Suggestion[]>;
  placeholder?: string;
  minChars?: number;
  debounceMs?: number;
  className?: string;
}

const TYPE_ICONS: Record<string, LucideIcon> = {
  kunde: User,
  referanse: ClipboardList,
  kunderef: Phone,
  firma: Building2,
  lager: Package,
  vare: Tag,
  varegruppe: Folder,
  henvisning: Link2,
};

function SuggestionTypeIcon({ type }: { type: string }) {
  const TypeIcon = TYPE_ICONS[type] ?? Search;
  return <TypeIcon className="h-3.5 w-3.5 opacity-60 shrink-0" aria-hidden />;
}

export function AutocompleteInput({
  id,
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  placeholder = 'Søk...',
  minChars = 3,
  debounceMs = 300,
  className = '',
}: AutocompleteInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedValue = useDebouncedValue(value, debounceMs);

  useEffect(() => {
    if (debouncedValue.length < minChars) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;

    (async () => {
      setIsLoading(true);
      try {
        const results = await fetchSuggestions(debouncedValue);
        if (cancelled) return;
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        if (cancelled) return;
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [debouncedValue, minChars, fetchSuggestions]);

  const handleClickOutside = useCallback(() => setIsOpen(false), []);
  useOnClickOutside(containerRef, handleClickOutside);

  const handleSelect = (suggestion: Suggestion) => {
    onChange(suggestion.suggestion);
    setIsOpen(false);
    onSelect?.(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        break;
    }
  };

  const listId = id ? `${id}-listbox` : undefined;
  const listOpen = isOpen && suggestions.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={`input pr-10 ${className}`}
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner size="xs" className="text-primary-500" />
          </div>
        )}
      </div>

      {listOpen && (
        <div
          id={listId}
          role="list"
          aria-label="Forslag"
          className="absolute z-[9999] w-full mt-1 bg-dark-800 border border-dark-700 rounded-md shadow-2xl overflow-y-auto max-h-48 ring-1 ring-black/50"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.suggestion}-${suggestion.type}-${index}`}
              onClick={() => handleSelect(suggestion)}
              onMouseEnter={() => setHighlightedIndex(index)}
              aria-current={index === highlightedIndex ? true : undefined}
              className={`w-full px-2 py-1 flex items-center gap-2 text-left transition-colors border-b border-dark-700/20 last:border-0 ${
                index === highlightedIndex
                  ? 'bg-primary-600/40 text-primary-100'
                  : 'hover:bg-dark-700/50'
              }`}
            >
              <SuggestionTypeIcon type={suggestion.type} />
              <div className="flex-1 min-w-0 leading-tight">
                <span className="block truncate text-xs font-medium">{suggestion.suggestion}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
