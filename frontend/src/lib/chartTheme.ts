/**
 * Phase 0 — central chart theme (additive, no behavior change).
 *
 * Captures the hardcoded values currently spread across
 * `components/Charts/BarChart.tsx`, `LineChart.tsx`, `PieChart.tsx` and
 * `components/Sparkline.tsx` so future phases can migrate call sites to a
 * single source. Importing this module changes nothing on its own.
 */

/** Primary series colour (default in Bar/Line/Sparkline). */
export const CHART_PRIMARY = '#6366f1';

/** Executive Dark categorical palette (currently PieChart COLORS). */
export const CHART_PALETTE = [
  '#6366f1',
  '#818cf8',
  '#a5b4fc',
  '#c9a962',
  '#94a3b8',
  '#64748b',
  '#475569',
  '#3f4c63',
] as const;

/** Axis grid + tick colours (currently hardcoded in Bar/Line charts). */
export const CHART_GRID = '#334155';
export const CHART_TICK = '#94a3b8';

/** Shared tooltip chrome (Bar/Line gold-border variant). */
export const CHART_TOOLTIP = {
  backgroundColor: 'rgba(15, 23, 42, 0.75)',
  border: '1px solid rgba(201, 169, 98, 0.22)',
  borderRadius: '16px',
  boxShadow: '0 4px 30px rgba(0, 0, 0, 0.5)',
  padding: '12px 16px',
} as const;

/** Animation durations (ms) — gate with `usePrefersReducedMotion` in later phases. */
export const CHART_ANIMATION = {
  bar: 0,
  line: 1500,
  sparkline: 800,
} as const;
