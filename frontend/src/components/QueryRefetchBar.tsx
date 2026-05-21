/** Thin progress bar shown during background refetch (keeps previous data visible). */
export function QueryRefetchBar({ active }: { active: boolean }) {
  if (!active) return null;

  return (
    <div
      role="progressbar"
      aria-label="Oppdaterer data"
      className="h-0.5 w-full overflow-hidden rounded-full bg-dark-800"
    >
      <div className="h-full w-1/3 rounded-full bg-primary-500 query-refetch-indeterminate" />
    </div>
  );
}
