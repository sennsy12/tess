export function WidgetError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 flex items-center justify-between gap-2">
      <span>Kunne ikke laste widget</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="text-xs underline hover:text-red-200">
          Prøv igjen
        </button>
      )}
    </div>
  );
}
