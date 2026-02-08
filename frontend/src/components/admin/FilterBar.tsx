import { useCallback, type ReactNode } from 'react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

/** Describes a single filter field rendered inside the bar. */
export interface FilterFieldDescriptor {
  /** Unique key – also used as the property name in the filters object */
  key: string;
  /** Label shown above the input */
  label: string;
  /** Input type; defaults to `"text"` */
  type?: 'text' | 'date' | 'number' | 'select';
  /** Placeholder text */
  placeholder?: string;
  /** Options for `type: "select"` */
  options?: { value: string; label: string }[];
  /** Grid column span override (Tailwind class, e.g. `"col-span-2"`) */
  colSpan?: string;
}

export interface FilterBarProps<T extends Record<string, any>> {
  /** Title shown above the filter grid */
  title?: string;
  /** Current filter state object */
  filters: T;
  /** Called whenever a filter value changes */
  onFilterChange: (filters: T) => void;
  /** Called when the user submits the form (search) */
  onSubmit?: () => void;
  /** Called when the user clicks "Reset" */
  onReset?: () => void;
  /** Declarative field descriptors */
  fields: FilterFieldDescriptor[];
  /** Additional content rendered after the fields (e.g. autocomplete inputs) */
  children?: ReactNode;
  /** Override the grid column count (Tailwind class, default `"lg:grid-cols-4"`) */
  gridCols?: string;
  /** Label for the submit button (default `"Søk"`) */
  submitLabel?: string;
  /** Label for the reset button (default `"Nullstill"`) */
  resetLabel?: string;
  /** Additional CSS classes */
  className?: string;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

/**
 * Reusable filter bar for admin pages.
 *
 * Accepts a declarative `fields` array that describes each filter input.
 * This removes the need to manually wire up grid layout, labels and
 * onChange handlers in every page.
 *
 * For advanced fields (e.g. `<AutocompleteInput>`), use the `children`
 * slot which is rendered at the end of the grid.
 *
 * @example
 * ```tsx
 * <FilterBar
 *   title="Søk i ordrer"
 *   filters={filters}
 *   onFilterChange={setFilters}
 *   onSubmit={() => setPage(1)}
 *   onReset={handleReset}
 *   fields={[
 *     { key: 'ordrenr', label: 'Ordrenummer', placeholder: 'F.eks. 1001' },
 *     { key: 'startDate', label: 'Fra dato', type: 'date' },
 *     { key: 'endDate', label: 'Til dato', type: 'date' },
 *   ]}
 * />
 * ```
 */
export function FilterBar<T extends Record<string, any>>({
  title,
  filters,
  onFilterChange,
  onSubmit,
  onReset,
  fields,
  children,
  gridCols = 'lg:grid-cols-4',
  submitLabel = 'Søk',
  resetLabel = 'Nullstill',
  className = '',
}: FilterBarProps<T>) {
  // Stable helper that updates a single key in the filters object
  const updateField = useCallback(
    (key: string, value: string) => {
      onFilterChange({ ...filters, [key]: value } as T);
    },
    [filters, onFilterChange],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.();
  };

  return (
    <form onSubmit={handleSubmit} className={`card ${className}`}>
      {title && <h3 className="text-lg font-semibold mb-4">{title}</h3>}

      <div className={`grid grid-cols-1 sm:grid-cols-2 ${gridCols} gap-4`}>
        {fields.map((field) => (
          <div key={field.key} className={field.colSpan ?? ''}>
            <label className="label">{field.label}</label>

            {field.type === 'select' ? (
              <select
                value={(filters[field.key] as string) ?? ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="input w-full"
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={field.type ?? 'text'}
                value={(filters[field.key] as string) ?? ''}
                onChange={(e) => updateField(field.key, e.target.value)}
                className="input w-full"
                placeholder={field.placeholder}
              />
            )}
          </div>
        ))}

        {/* Extra slot for custom inputs (e.g. AutocompleteInput) */}
        {children}
      </div>

      {(onSubmit || onReset) && (
        <div className="flex gap-3 mt-4">
          {onSubmit && (
            <button type="submit" className="btn-primary">
              {submitLabel}
            </button>
          )}
          {onReset && (
            <button type="button" onClick={onReset} className="btn-secondary">
              {resetLabel}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
