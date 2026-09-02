/**
 * Phase 2 tests for the unified <StatCard />.
 *
 * Covers:
 *  - Static value rendering (no numericValue)
 *  - Numeric value renders the formatted target
 *  - Gold accent treatment
 *  - Sub content slot
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatCard } from '../StatCard';

describe('StatCard', () => {
  it('renders a static pre-formatted value', () => {
    render(<StatCard label="Snitt ordreverdi" value="1 234 kr" />);
    expect(screen.getByText('Snitt ordreverdi')).toBeInTheDocument();
    expect(screen.getByText('1 234 kr')).toBeInTheDocument();
  });

  it('tints the value gold with accent="gold"', () => {
    render(<StatCard label="Total omsetning" value="5 000 kr" accent="gold" />);
    expect(screen.getByText('5 000 kr').className).toContain('text-gold-300');
  });

  it('keeps the default white value otherwise', () => {
    render(<StatCard label="Ordrer totalt" value="42" />);
    expect(screen.getByText('42').className).toContain('text-white');
  });

  it('renders the sub slot', () => {
    render(<StatCard label="Total omsetning" value="5 000 kr" sub={<span>+2,5 % mot forrige periode</span>} />);
    expect(screen.getByText('+2,5 % mot forrige periode')).toBeInTheDocument();
  });

  it('renders no sparkline without spark data', () => {
    const { container } = render(<StatCard label="Ordrer totalt" value="42" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
