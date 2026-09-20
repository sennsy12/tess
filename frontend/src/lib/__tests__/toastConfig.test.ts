/**
 * Tests for the global toast theme (`lib/toastConfig.ts`).
 *
 * react-hot-toast renders inline styles, so the Executive Dark tokens are
 * pinned as hex/rgba literals in `toastConfig.ts`. These tests guard the
 * token alignment: the surface must match `--surface-raised` from
 * `index.css`, and icon hues must come from the bright 400-weight families
 * used by the rest of the design system — off-system hex values (like the
 * previous `#1e1e2e` purple-grey surface) must fail here.
 */
import { describe, it, expect } from 'vitest';
import {
  TOAST_SURFACE,
  TOAST_HUES,
  toasterConfig,
} from '../toastConfig';

// Pinned from the `:root` block in src/index.css — keep in sync.
const SURFACE_RAISED = '#131c30';

describe('toastConfig — Executive Dark token alignment', () => {
  it('uses the raised navy surface, never the old off-system purple', () => {
    expect(TOAST_SURFACE).toBe(SURFACE_RAISED);
    expect(TOAST_SURFACE).not.toBe('#1e1e2e');
  });

  it('uses bright 400-weight status hues from the design system', () => {
    expect(TOAST_HUES.success).toBe('#34d399'); // emerald-400
    expect(TOAST_HUES.error).toBe('#f87171'); // red-400
    expect(TOAST_HUES.loading).toBe('#818cf8'); // primary-400 (indigo)
    // Old generic 500-weight hues must not return:
    expect(Object.values(TOAST_HUES)).not.toContain('#10b981');
    expect(Object.values(TOAST_HUES)).not.toContain('#ef4444');
  });

  it('styles the toast surface with hairline border and card-like elevation', () => {
    const style = toasterConfig.toastOptions.style;
    expect(style.background).toBe(SURFACE_RAISED);
    expect(style.border).toContain('rgba(148, 163, 184');
    expect(style.boxShadow).toBeTruthy();
    expect(style.borderRadius).toBe('10px');
  });

  it('wires icon themes for success, error and loading to the hues', () => {
    const opts = toasterConfig.toastOptions;
    expect(opts.success?.iconTheme).toEqual({
      primary: TOAST_HUES.success,
      secondary: SURFACE_RAISED,
    });
    expect(opts.error?.iconTheme).toEqual({
      primary: TOAST_HUES.error,
      secondary: SURFACE_RAISED,
    });
    expect(opts.loading?.iconTheme).toEqual({
      primary: TOAST_HUES.loading,
      secondary: SURFACE_RAISED,
    });
    // Errors stay visible longer than the default duration.
    expect(opts.error?.duration).toBeGreaterThan(opts.duration);
  });

  it('keeps the established placement and default duration', () => {
    expect(toasterConfig.position).toBe('bottom-right');
    expect(toasterConfig.toastOptions.duration).toBe(4000);
  });
});
