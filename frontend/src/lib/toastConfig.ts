/**
 * Global react-hot-toast theme — Executive Dark.
 *
 * The Toaster renders inline styles (not Tailwind classes), so the design
 * tokens from `src/index.css` are pinned here. Keep these in sync with the
 * token block in `:root`:
 *
 *   surface-raised  #131c30               (--surface-raised)
 *   hairline        rgba(148,163,184,.16) (--hairline-neutral)
 *   success hue     #34d399 (emerald-400) — same family as `StatusBadge`
 *   error hue       #f87171 (red-400)
 *   loading hue     #818cf8 (primary-400) — indigo spinner family
 *
 * Note: never use `#1e1e2e`-style off-system purples here — they drift from
 * the navy surfaces used everywhere else (see the previous theme).
 */
export const TOAST_SURFACE = '#131c30';

/** Status hues for toast icons — bright 400-weights for the dark surface. */
export const TOAST_HUES = {
  success: '#34d399',
  error: '#f87171',
  loading: '#818cf8',
} as const;

export const toasterConfig = {
  position: 'bottom-right',
  toastOptions: {
    duration: 4000,
    style: {
      background: TOAST_SURFACE,
      color: '#f8fafc',
      border: '1px solid rgba(148, 163, 184, 0.16)',
      // Layered elevation, mirrors `.card` depth (shadow over glow).
      boxShadow:
        '0 12px 32px -8px rgba(2, 6, 23, 0.55), 0 2px 8px -2px rgba(2, 6, 23, 0.4)',
      borderRadius: '10px',
    },
    success: {
      duration: 4000,
      iconTheme: { primary: TOAST_HUES.success, secondary: TOAST_SURFACE },
    },
    error: {
      duration: 5000,
      iconTheme: { primary: TOAST_HUES.error, secondary: TOAST_SURFACE },
    },
    loading: {
      iconTheme: { primary: TOAST_HUES.loading, secondary: TOAST_SURFACE },
    },
  },
} as const;
