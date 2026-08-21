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

/** YYYY-MM-DD in local timezone (safe for `<input type="date">`). */
export function toDateInputLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Returns a local date string `days` before `from` (default: today). */
export function shiftDaysLocal(days: number, from: Date = new Date()): string {
  const date = new Date(from);
  date.setDate(date.getDate() - days);
  return toDateInputLocal(date);
}

/** Parses a positive number from user input, or null if invalid. */
export function parsePositiveNumber(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Parses an integer and clamps it to [min, max]; non-numeric input returns min. */
export function parseBoundedInt(raw: string, min: number, max: number): number {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

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

/** Parses Norwegian-formatted numbers: "1 234,56", "1.234,56", "1234.56". */
export function parseNorwegianNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let normalized = trimmed.replace(/\s/g, '');

  // Norwegian: dot thousands + comma decimal (1.234,56)
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(,\d{3})*(\.\d+)?$/.test(normalized)) {
    // US-style: comma thousands + dot decimal
    normalized = normalized.replace(/,/g, '');
  } else {
    normalized = normalized.replace(',', '.');
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Formats a ratio as a Norwegian percentage, e.g. "12,5 %". */
export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100);
}

/** Splits a gross amount into netto, mva, and brutto (default 25% MVA). */
export function splitGrossWithMva(amount: number, rate = 0.25): {
  netto: number;
  mva: number;
  brutto: number;
} {
  const netto = amount / (1 + rate);
  const mva = amount - netto;
  return { netto, mva, brutto: amount };
}

/** @deprecated Use splitGrossWithMva */
export const formatMva = splitGrossWithMva;

const relativeTimeFormatter = new Intl.RelativeTimeFormat('nb', { numeric: 'auto' });

/** Returns a Norwegian relative time string, e.g. "for 5 min siden". */
export function formatRelativeTimeNb(date: Date | string): string {
  const target = new Date(date);
  const now = Date.now();
  const diffMs = target.getTime() - now;
  const absMs = Math.abs(diffMs);

  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 365 * 24 * 60 * 60 * 1000],
    ['month', 30 * 24 * 60 * 60 * 1000],
    ['day', 24 * 60 * 60 * 1000],
    ['hour', 60 * 60 * 1000],
    ['minute', 60 * 1000],
    ['second', 1000],
  ];

  for (const [unit, ms] of units) {
    if (absMs >= ms || unit === 'second') {
      const value = Math.round(diffMs / ms);
      return relativeTimeFormatter.format(value, unit);
    }
  }

  return relativeTimeFormatter.format(0, 'second');
}

/** Normalizes and displays a customer number (zero-padded to 6 digits when numeric). */
export function formatKundenr(value: string | number): string {
  const raw = String(value).trim();
  if (/^\d+$/.test(raw)) {
    return raw.padStart(6, '0');
  }
  return raw;
}

/** Formats a Norwegian org number as "987 654 321". */
export function formatOrgnr(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 9) return value.trim();
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

/** Validates a Norwegian org number using mod-11. */
export function isValidOrgnr(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 9) return false;

  const weights = [3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += Number(digits[i]) * weights[i];
  }

  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : 11 - remainder;
  if (checkDigit === 11) return false;

  return checkDigit === Number(digits[8]);
}
