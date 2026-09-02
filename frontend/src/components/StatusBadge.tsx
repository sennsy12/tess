import type { ReactNode } from 'react';

export type StatusBadgeTone = 'success' | 'neutral' | 'info';

const TONE_STYLES: Record<StatusBadgeTone, string> = {
  success: 'bg-green-600/20 text-green-300',
  neutral: 'bg-dark-600/40 text-dark-300',
  info: 'bg-primary-600/20 text-primary-300',
};

interface StatusBadgeProps {
  tone?: StatusBadgeTone;
  children: ReactNode;
  className?: string;
}

/**
 * Generic status pill (Aktiv/Inaktiv, varegruppe tags, …).
 * Single shape (`rounded-full`) for all non-workflow badges — previously
 * each call site hardcoded its own `rounded` + colour combo.
 */
export function StatusBadge({ tone = 'neutral', children, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${TONE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
