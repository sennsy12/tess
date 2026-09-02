/**
 * Global react-hot-toast theme.
 *
 * The Toaster renders inline styles (not Tailwind classes), so the Executive
 * Dark surface tokens are pinned here: `#1e1e2e` raised surface, `#2d2d3f`
 * hairline, and the shared emerald/red status hues.
 */
export const toasterConfig = {
  position: 'bottom-right',
  toastOptions: {
    duration: 4000,
    style: {
      background: '#1e1e2e',
      color: '#e2e8f0',
      border: '1px solid #2d2d3f',
    },
    success: {
      duration: 4000,
      iconTheme: { primary: '#10b981', secondary: '#1e1e2e' },
    },
    error: {
      duration: 5000,
      iconTheme: { primary: '#ef4444', secondary: '#1e1e2e' },
    },
  },
} as const;
