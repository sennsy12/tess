export const formatCurrencyNok = (value: number) =>
  new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(value);

export const formatNumberNb = (value: number) =>
  new Intl.NumberFormat('nb-NO').format(value);

export const formatDateNb = (value: Date | string) =>
  new Intl.DateTimeFormat('nb-NO').format(new Date(value));

/**
 * Abbreviates large numbers for chart axes and compact displays.
 * Examples: 1 234 -> "1,2k", 3 600 000 -> "3,6m", 1 200 000 000 -> "1,2mrd"
 * Keeps full precision for small values (<1000).
 */
export const abbreviateNumber = (value: number): string => {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    const v = abs / 1_000_000_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}mrd`;
  }
  if (abs >= 1_000_000) {
    const v = abs / 1_000_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}m`;
  }
  if (abs >= 1_000) {
    const v = abs / 1_000;
    return `${sign}${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}k`;
  }
  return new Intl.NumberFormat('nb-NO').format(value);
};

/**
 * Abbreviated currency formatter for chart axes: "3,6m kr", "850k kr"
 */
export const abbreviateCurrencyNok = (value: number): string =>
  `${abbreviateNumber(value)} kr`;

/**
 * Truncates a string to maxLen characters, adding ellipsis if truncated.
 */
export const truncateLabel = (label: string, maxLen: number = 14): string => {
  if (!label || label.length <= maxLen) return label;
  return `${label.slice(0, maxLen - 1)}…`;
};
