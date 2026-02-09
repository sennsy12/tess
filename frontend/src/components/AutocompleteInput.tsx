import { useState, useEffect, useRef } from 'react';

interface Suggestion {
  suggestion: string;
  type: string;
}

interface AutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (suggestion: Suggestion) => void;
  fetchSuggestions: (query: string) => Promise<Suggestion[]>;
  placeholder?: string;
  minChars?: number;
  debounceMs?: number;
  className?: string;
}

export function AutocompleteInput({
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
  const debounceRef = useRef<NodeJS.Timeout>();

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.length < minChars) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await fetchSuggestions(value);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setHighlightedIndex(-1);
      } catch (error) {
        console.error('Failed to fetch suggestions:', error);
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [value, minChars, debounceMs, fetchSuggestions]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'kunde': return '👤';
      case 'referanse': return '📋';
      case 'kunderef': return '📞';
      case 'firma': return '🏢';
      case 'lager': return '📦';
      case 'vare': return '🏷️';
      case 'varegruppe': return '📁';
      case 'henvisning': return '🔗';
      default: return '🔍';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'kunde': return 'Kunde';
      case 'referanse': return 'Referanse';
      case 'kunderef': return 'Kunderef';
      case 'firma': return 'Firma';
      case 'lager': return 'Lager';
      case 'vare': return 'Produkt';
      case 'varegruppe': return 'Varegruppe';
      case 'henvisning': return 'Henvisning';
      default: return type;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={`input pr-10 ${className}`}
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin w-4 h-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-dark-800 border border-dark-700 rounded-md shadow-2xl overflow-y-auto max-h-48 ring-1 ring-black/50">
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.suggestion}-${suggestion.type}-${index}`}
              onClick={() => handleSelect(suggestion)}
              className={`w-full px-2 py-1 flex items-center gap-2 text-left transition-colors border-b border-dark-700/20 last:border-0 ${
                index === highlightedIndex
                  ? 'bg-primary-600/40 text-primary-100'
                  : 'hover:bg-dark-700/50'
              }`}
            >
              <span className="text-xs opacity-60">{getTypeIcon(suggestion.type)}</span>
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
