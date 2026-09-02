import { Loader2 } from 'lucide-react';

const SPINNER_SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-12 w-12',
} as const;

export type SpinnerSize = keyof typeof SPINNER_SIZES;

interface SpinnerProps {
  /** Visual size (default "md"). Inherits text colour via currentColor. */
  size?: SpinnerSize;
  /** Extra classes (e.g. `text-primary-500` for page loaders). */
  className?: string;
  /**
   * Accessible label for standalone loaders (page/section level).
   * Renders `role="status"` + sr-only text. Omit for button spinners
   * (the button's disabled state already conveys busyness).
   */
  label?: string;
}

/**
 * Single loading indicator for the whole app — replaces the ad-hoc
 * `animate-spin rounded-full border-*` divs and scattered `Loader2` uses.
 * Colour comes from `className` (defaults to `currentColor`).
 */
export function Spinner({ size = 'md', className = '', label }: SpinnerProps) {
  if (label) {
    return (
      <span role="status" className={`inline-flex items-center justify-center ${className}`}>
        <Loader2 className={`${SPINNER_SIZES[size]} animate-spin`} aria-hidden />
        <span className="sr-only">{label}</span>
      </span>
    );
  }
  return <Loader2 className={`${SPINNER_SIZES[size]} animate-spin ${className}`} aria-hidden />;
}
