import type { ReactNode } from 'react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PageHeaderProps {
  /** Page subtitle or description shown below the title */
  subtitle?: string;
  /** Numeric count rendered next to the subtitle (e.g. total items) */
  count?: number;
  /** Noun used after the count, e.g. "brukere" → "42 brukere totalt" */
  countLabel?: string;
  /** Optional action area – typically a button or group of buttons */
  action?: ReactNode;
  /** Additional CSS classes for the root wrapper */
  className?: string;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

/**
 * Standardised page header for admin pages.
 *
 * Provides a consistent layout: left-aligned description / count
 * and right-aligned action slot. Fully responsive.
 *
 * @example
 * ```tsx
 * <PageHeader
 *   count={pagination.total}
 *   countLabel="brukere"
 *   action={<button className="btn-primary">+ Ny bruker</button>}
 * />
 * ```
 */
export function PageHeader({
  subtitle,
  count,
  countLabel,
  action,
  className = '',
}: PageHeaderProps) {
  const hasCount = count !== undefined && count !== null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${className}`}
    >
      <div>
        {subtitle && <p className="text-dark-400">{subtitle}</p>}
        {hasCount && countLabel && (
          <p className="text-dark-400">
            {count} {countLabel}
            {count !== 1 ? '' : ''} totalt
          </p>
        )}
      </div>

      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
