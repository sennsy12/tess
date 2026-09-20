/**
 * Tests for the DataTable empty state.
 *
 * The empty state is now the app-wide <EmptyState> with an Executive Dark
 * illustration (retiring the old inline PackageSearch block). Locks in:
 *  - default: EmptySearch illustration + the historical message texts
 *  - call sites can pass their own illustration and a call-to-action
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable } from '../DataTable';
import { EmptyOrders } from '../emptyStates/EmptyIllustrations';

const columns = [
  { key: 'id' as const, header: 'ID' },
  { key: 'name' as const, header: 'Name' },
];

describe('DataTable empty state', () => {
  it('shows the default EmptySearch illustration with the message', () => {
    const { container } = render(
      <DataTable<{ id: number; name: string }> data={[]} columns={columns} />,
    );

    expect(screen.getByText('Ingen data funnet')).toBeInTheDocument();
    expect(container.querySelector('.empty-illo svg')).toBeInTheDocument();
  });

  it('renders a call-site illustration and call-to-action when provided', () => {
    render(
      <DataTable<{ id: number; name: string }>
        data={[]}
        columns={columns}
        emptyMessage="Ingen ordrer funnet"
        emptyIllustration={<EmptyOrders />}
        emptyAction={<button type="button">Ny bestilling</button>}
      />,
    );

    expect(screen.getByText('Ingen ordrer funnet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ny bestilling' })).toBeInTheDocument();
    // Call-site illustration (document motif) rather than the default magnifier.
    expect(document.querySelectorAll('.empty-illo-accent')).toHaveLength(1);
  });
});
