/**
 * Tests for the upgraded <EmptyState />.
 *
 * Locks in the two-variant contract:
 *  - `illustration` (Executive Dark SVG) takes precedence over `icon`
 *  - the visual is decorative (aria-hidden) — the title carries meaning
 *  - `action` renders inside the component
 *  - `icon` fallback keeps the original lucide-in-circle look
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { EmptyState } from '../EmptyState';
import { EmptyOrders } from '../emptyStates/EmptyIllustrations';

describe('EmptyState', () => {
  it('renders title, description and action', () => {
    render(
      <EmptyState
        title="Ingen ordrer ennå"
        description="Når du legger inn bestillinger vil de vises her."
        action={<button type="button">Ny bestilling</button>}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ingen ordrer ennå' })).toBeInTheDocument();
    expect(screen.getByText('Når du legger inn bestillinger vil de vises her.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ny bestilling' })).toBeInTheDocument();
  });

  it('renders the illustration instead of the icon circle when set', () => {
    const { container } = render(
      <EmptyState title="Tom" illustration={<EmptyOrders />} />,
    );

    // Illustration is an inline SVG, not the lucide circle fallback.
    expect(container.querySelector('.empty-illo svg')).toBeInTheDocument();
    expect(container.querySelector('.empty-illo-accent')).toBeInTheDocument();
  });

  it('keeps the illustration decorative (aria-hidden) so titles stay canonical', () => {
    const { container } = render(
      <EmptyState title="Tom" illustration={<EmptyOrders />} />,
    );

    expect(container.querySelector('.empty-illo')).toHaveAttribute('aria-hidden', 'true');
  });

  it('falls back to the lucide icon circle when no illustration is given', () => {
    const { container } = render(
      <EmptyState title="Tom" icon={<span data-testid="custom-icon" />} />,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(container.querySelector('.empty-illo')).toBeNull();
  });
});
