/**
 * Regression: PieChart must survive rows whose name field is missing.
 *
 * Real-world path: statistics drill-down flips nameKey (kunde → varenavn)
 * while `placeholderData` still shows the previous group's rows. Recharts
 * then falls back to the slice VALUE (a number) as the label, which used to
 * crash renderLabel/renderLegend with "label.slice is not a function".
 *
 * jsdom gives recharts zero layout size, so the SVG tree never mounts here —
 * the crash logic is pinned at the formatter layer instead, plus a mount
 * smoke test for the chart component.
 */
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { truncateLabel } from '../../../lib/formatters';
import { PieChart } from '../PieChart';

// ResponsiveContainer cannot measure in jsdom; bypass measurement so the
// component tree builds.
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 600, height: 360 }}>{children}</div>
    ),
  };
});

describe('truncateLabel with non-string labels (drill-down fallback)', () => {
  it('stringifies numeric fallback labels instead of crashing', () => {
    expect(truncateLabel(227380)).toBe('227380');
    expect(truncateLabel(48000.5)).toBe('48000.5');
  });

  it('handles null/undefined as empty string', () => {
    expect(truncateLabel(null)).toBe('');
    expect(truncateLabel(undefined)).toBe('');
  });

  it('still truncates and ellipsises long strings', () => {
    expect(truncateLabel('Hydraulikksylinder', 10)).toBe('Hydraulik.');
    expect(truncateLabel('Kort', 10)).toBe('Kort');
  });
});

describe('PieChart mount smoke with missing nameKey values', () => {
  it('mounts without throwing when rows lack the nameKey field', () => {
    const mixed = [
      { varenavn: 'Hydraulikksylinder', total_sum: 48000 },
      { kundenavn: 'Aker Solutions AS', total_sum: 227380 },
      { kundenavn: 'Hydro Aluminium AS', total_sum: 179040 },
    ];

    expect(() =>
      render(
        <PieChart data={mixed as never} nameKey="varenavn" valueKey="total_sum" title="Fordeling" />
      )
    ).not.toThrow();
  });
});
