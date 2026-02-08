import { useMemo, useCallback } from 'react';

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface PaginationInfo {
  /** Current page number (1-indexed) */
  page: number;
  /** Total number of items across all pages */
  total: number;
  /** Items per page */
  limit: number;
  /** Total number of pages (computed if omitted) */
  totalPages?: number;
}

export interface PaginationProps {
  /** Pagination state produced by the server or local computation */
  pagination: PaginationInfo;
  /** Callback fired when the user selects a new page */
  onPageChange: (page: number) => void;
  /**
   * Visual variant:
   * - `"full"` – first/prev/page-numbers/next/last + summary text (default)
   * - `"simple"` – prev / "Side X av Y" / next
   * - `"minimal"` – prev / next only
   */
  variant?: 'full' | 'simple' | 'minimal';
  /** Override the item noun shown in the summary, e.g. "ordrer" or "brukere" */
  itemLabel?: string;
  /** How many page-number buttons to show on each side of the current page (default 2) */
  siblingCount?: number;
  /** Additional CSS classes applied to the root element */
  className?: string;
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** Build the array of visible page numbers (with `null` gaps for ellipsis). */
function buildPageRange(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): (number | null)[] {
  const pages: (number | null)[] = [];
  const start = Math.max(1, currentPage - siblingCount);
  const end = Math.min(totalPages, currentPage + siblingCount);

  if (start > 1) pages.push(null); // leading ellipsis
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < totalPages) pages.push(null); // trailing ellipsis

  return pages;
}

// ────────────────────────────────────────────────────────────
// Shared button styles
// ────────────────────────────────────────────────────────────

const NAV_BTN =
  'px-2.5 py-1.5 rounded-lg text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed hover:bg-dark-800 text-dark-300';

const PAGE_BTN_BASE =
  'min-w-[36px] py-1.5 rounded-lg text-sm font-medium transition-all';

const PAGE_BTN_ACTIVE =
  'bg-primary-600 text-white shadow-md shadow-primary-600/20';

const PAGE_BTN_INACTIVE = 'text-dark-300 hover:bg-dark-800';

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

/**
 * Reusable, senior-level Pagination component designed for the Tess admin UI.
 *
 * Supports three visual variants (`full`, `simple`, `minimal`) while keeping
 * API surface small and predictable.
 */
export function Pagination({
  pagination,
  onPageChange,
  variant = 'full',
  itemLabel,
  siblingCount = 2,
  className = '',
}: PaginationProps) {
  const { page, total, limit } = pagination;
  const totalPages = pagination.totalPages ?? Math.ceil(total / limit);

  // Don't render when there is only one page
  if (totalPages <= 1) return null;

  const isFirst = page === 1;
  const isLast = page === totalPages;

  // Stable callbacks so consumer can safely pass without useCallback wrapping
  const goFirst = useCallback(() => onPageChange(1), [onPageChange]);
  const goPrev = useCallback(
    () => onPageChange(Math.max(1, page - 1)),
    [onPageChange, page],
  );
  const goNext = useCallback(
    () => onPageChange(Math.min(totalPages, page + 1)),
    [onPageChange, page, totalPages],
  );
  const goLast = useCallback(
    () => onPageChange(totalPages),
    [onPageChange, totalPages],
  );

  // Visible range – only computed for the "full" variant
  const pageRange = useMemo(
    () => (variant === 'full' ? buildPageRange(page, totalPages, siblingCount) : []),
    [variant, page, totalPages, siblingCount],
  );

  // Summary text (e.g. "Side 2 av 10 · 193 brukere totalt")
  const summaryText = itemLabel
    ? `Side ${page} av ${totalPages} \u00B7 ${total} ${itemLabel} totalt`
    : `Side ${page} av ${totalPages}`;

  // ── minimal variant ──────────────────────────────────────
  if (variant === 'minimal') {
    return (
      <div className={`flex items-center justify-center gap-2 ${className}`}>
        <button onClick={goPrev} disabled={isFirst} className={NAV_BTN}>
          Forrige
        </button>
        <span className="px-3 py-1 text-sm text-dark-400">
          Side {page} av {totalPages}
        </span>
        <button onClick={goNext} disabled={isLast} className={NAV_BTN}>
          Neste
        </button>
      </div>
    );
  }

  // ── simple variant ───────────────────────────────────────
  if (variant === 'simple') {
    return (
      <div
        className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
      >
        <span className="text-sm text-dark-400">{summaryText}</span>
        <div className="flex items-center gap-2">
          <button onClick={goPrev} disabled={isFirst} className={NAV_BTN}>
            Forrige
          </button>
          <span className="px-3 py-1 text-sm">
            Side {page} av {totalPages}
          </span>
          <button onClick={goNext} disabled={isLast} className={NAV_BTN}>
            Neste
          </button>
        </div>
      </div>
    );
  }

  // ── full variant (default) ───────────────────────────────
  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}
    >
      <span className="text-sm text-dark-400">{summaryText}</span>

      <div className="flex items-center gap-1">
        {/* First */}
        <button
          onClick={goFirst}
          disabled={isFirst}
          className={NAV_BTN}
          title="Første side"
        >
          ««
        </button>
        {/* Prev */}
        <button onClick={goPrev} disabled={isFirst} className={NAV_BTN}>
          «
        </button>

        {/* Page numbers */}
        {pageRange.map((p, idx) =>
          p === null ? (
            <span key={`ellipsis-${idx}`} className="px-1 text-dark-500 text-sm">
              ...
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={`${PAGE_BTN_BASE} ${p === page ? PAGE_BTN_ACTIVE : PAGE_BTN_INACTIVE}`}
            >
              {p}
            </button>
          ),
        )}

        {/* Next */}
        <button onClick={goNext} disabled={isLast} className={NAV_BTN}>
          »
        </button>
        {/* Last */}
        <button
          onClick={goLast}
          disabled={isLast}
          className={NAV_BTN}
          title="Siste side"
        >
          »»
        </button>
      </div>
    </div>
  );
}
