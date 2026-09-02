/** Formats a signed percentage, e.g. "+12.50%". */
export const pct = (v: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

/** Tailwind text colour class reflecting the sign of a difference. */
export const diffColor = (v: number): string =>
  v > 0 ? 'text-green-400' : v < 0 ? 'text-red-400' : 'text-dark-400';
