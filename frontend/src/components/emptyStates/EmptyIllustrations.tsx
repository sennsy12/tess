/**
 * Executive Dark empty-state illustrations.
 *
 * Inline SVGs (no network fetch, no bundler assets) so they theme with the
 * app and cost nothing at runtime. Shared visual language:
 *
 *   - 144×96 viewBox, 1.5px strokes, round caps
 *   - structure   #475569 (dark-600) / #334155 (dark-700)
 *   - surfaces    rgba(148,163,184,0.04–0.07)
 *   - highlights  #818cf8 (primary-400) · champagne #c9a962 (gold-500)
 *   - `.empty-illo-accent` groups float gently (see index.css);
 *     `prefers-reduced-motion` disables it globally
 *
 * Deliberately NO gradient defs: multiple instances on one page would need
 * unique ids per instance (the exact duplicate-gradient-id bug class fixed
 * in `Charts/BarChart`). Flat rgba fills keep the SVGs stateless.
 */
export interface EmptyIllustrationProps {
  /** Extra classes for the `<svg>` (base sizing comes from the container). */
  className?: string;
}

/** Sales document with line items and a floating «create» badge. */
export function EmptyOrders({ className = '' }: EmptyIllustrationProps) {
  return (
    <svg viewBox="0 0 144 96" fill="none" className={className} focusable="false">
      <ellipse cx="72" cy="87" rx="32" ry="3.5" fill="rgba(2, 6, 23, 0.5)" />
      {/* Order document */}
      <rect x="44" y="12" width="54" height="68" rx="4" fill="rgba(148, 163, 184, 0.05)" stroke="#475569" strokeWidth="1.5" />
      <path d="M84 12 L98 26 H84 Z" fill="rgba(148, 163, 184, 0.1)" stroke="#475569" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Line items — one picked out in gold, then a gold totals hairline */}
      <line x1="52" y1="38" x2="88" y2="38" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="52" y1="46" x2="78" y2="46" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="52" y1="54" x2="84" y2="54" stroke="#c9a962" strokeOpacity="0.55" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="52" y1="68" x2="88" y2="68" stroke="#c9a962" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
      {/* Floating «add» badge */}
      <g className="empty-illo-accent">
        <circle cx="96" cy="68" r="12" fill="#0f172a" stroke="#818cf8" strokeWidth="1.5" />
        <path d="M96 62.5 V73.5 M90.5 68 H101.5" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      {/* Sparkles */}
      <path d="M30 23 v6 M27 26 h6" stroke="#c9a962" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="114" cy="30" r="1.5" fill="#c9a962" fillOpacity="0.7" />
    </svg>
  );
}

/** Dashed result panel searched by a magnifier with a champagne handle. */
export function EmptySearch({ className = '' }: EmptyIllustrationProps) {
  return (
    <svg viewBox="0 0 144 96" fill="none" className={className} focusable="false">
      <ellipse cx="72" cy="87" rx="30" ry="3.5" fill="rgba(2, 6, 23, 0.5)" />
      {/* Dashed «no matches» panel */}
      <rect x="46" y="12" width="54" height="64" rx="4" fill="rgba(148, 163, 184, 0.04)" stroke="#334155" strokeWidth="1.5" strokeDasharray="5 4" />
      <line x1="54" y1="26" x2="82" y2="26" stroke="#334155" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="34" x2="74" y2="34" stroke="#334155" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="54" y1="42" x2="80" y2="42" stroke="#334155" strokeOpacity="0.8" strokeWidth="1.5" strokeLinecap="round" />
      {/* Magnifier — indigo glass, champagne handle */}
      <g className="empty-illo-accent">
        <circle cx="84" cy="54" r="13" fill="#172033" stroke="#818cf8" strokeWidth="2" />
        <circle cx="79.5" cy="49.5" r="3.5" stroke="#818cf8" strokeOpacity="0.35" strokeWidth="1.5" />
        <line x1="94" y1="64" x2="107" y2="77" stroke="#c9a962" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      {/* Sparkles */}
      <path d="M34 17 v6 M31 20 h6" stroke="#c9a962" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="114" cy="22" r="1.5" fill="#818cf8" fillOpacity="0.7" />
    </svg>
  );
}

/** Open carton with an indigo price tag — catalog, cart, pricing. */
export function EmptyCatalog({ className = '' }: EmptyIllustrationProps) {
  return (
    <svg viewBox="0 0 144 96" fill="none" className={className} focusable="false">
      <ellipse cx="72" cy="86" rx="30" ry="3.5" fill="rgba(2, 6, 23, 0.5)" />
      {/* Open back flaps */}
      <path d="M46 40 L34 28 L66 28 L72 40 Z" fill="rgba(148, 163, 184, 0.03)" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M98 40 L110 28 L78 28 L72 40 Z" fill="rgba(148, 163, 184, 0.03)" stroke="#334155" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Box body */}
      <rect x="44" y="40" width="56" height="34" rx="3" fill="rgba(148, 163, 184, 0.05)" stroke="#475569" strokeWidth="1.5" />
      <rect x="44" y="40" width="56" height="8" fill="rgba(148, 163, 184, 0.07)" />
      <line x1="72" y1="40" x2="72" y2="74" stroke="#c9a962" strokeOpacity="0.4" strokeWidth="1.5" />
      <line x1="50" y1="68" x2="94" y2="68" stroke="#c9a962" strokeOpacity="0.35" strokeWidth="1.5" strokeLinecap="round" />
      {/* Hanging tag */}
      <g className="empty-illo-accent">
        <path d="M100 47 L108 55" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="104" y="54" width="20" height="13" rx="3" fill="rgba(99, 102, 241, 0.12)" stroke="#818cf8" strokeWidth="1.5" />
        <circle cx="109" cy="60.5" r="1.6" stroke="#818cf8" strokeWidth="1.2" />
      </g>
      {/* Sparkle */}
      <path d="M30 61 v6 M27 64 h6" stroke="#c9a962" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** Empty chart panel — statistics, audit, ETL jobs, account data. */
export function EmptyData({ className = '' }: EmptyIllustrationProps) {
  return (
    <svg viewBox="0 0 144 96" fill="none" className={className} focusable="false">
      <ellipse cx="72" cy="87" rx="30" ry="3.5" fill="rgba(2, 6, 23, 0.5)" />
      {/* Chart panel + axes */}
      <rect x="40" y="14" width="64" height="58" rx="4" fill="rgba(148, 163, 184, 0.05)" stroke="#475569" strokeWidth="1.5" />
      <path d="M48 22 V64 H96" stroke="#334155" strokeWidth="1.5" strokeLinecap="round" />
      {/* Bars: one indigo, one dashed (the missing data), one gold */}
      <rect x="52" y="47" width="9" height="17" rx="1" fill="rgba(99, 102, 241, 0.35)" stroke="#818cf8" strokeWidth="1.2" />
      <rect x="65" y="36" width="9" height="28" rx="1" stroke="#334155" strokeWidth="1.2" strokeDasharray="4 3" />
      <rect x="78" y="42" width="9" height="22" rx="1" fill="rgba(201, 169, 98, 0.28)" stroke="#c9a962" strokeWidth="1.2" />
      {/* Dashed trend line with floating dot */}
      <g className="empty-illo-accent">
        <polyline points="53,30 68,24 85,28" stroke="#c9a962" strokeOpacity="0.55" strokeWidth="1.5" strokeDasharray="3 3" strokeLinecap="round" />
        <circle cx="85" cy="28" r="2.2" fill="#c9a962" fillOpacity="0.8" />
      </g>
      {/* Sparkles */}
      <path d="M32 23 v6 M29 26 h6" stroke="#c9a962" strokeOpacity="0.7" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="116" cy="50" r="1.5" fill="#818cf8" fillOpacity="0.7" />
    </svg>
  );
}
