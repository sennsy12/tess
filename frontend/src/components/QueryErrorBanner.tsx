interface QueryErrorBannerProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Inline error banner for failed React Query requests with optional retry.
 */
export function QueryErrorBanner({
  message = 'Klarte ikke laste data. Prøv igjen.',
  onRetry,
  className = '',
}: QueryErrorBannerProps) {
  return (
    <div
      className={`rounded-lg border border-red-800/50 bg-red-900/20 px-4 py-3 text-sm text-red-200 ${className}`}
      role="alert"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p>{message}</p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="btn-secondary text-sm shrink-0">
            Prøv igjen
          </button>
        )}
      </div>
    </div>
  );
}
