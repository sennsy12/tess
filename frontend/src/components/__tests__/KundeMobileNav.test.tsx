/**
 * Phase 1 tests for the unified bottom-bar navigation.
 *
 * Covers:
 *  - Tabs render from the shared navConfig source (order + short labels)
 *  - Cart badge renders on the Bestill tab
 *  - Active tab announced via aria-current
 *  - "Mer" sheet exposes sidebar-only entries, closes on Escape/navigate
 *  - Analyse bar renders its 2 entries with no "Mer" button
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { AnalyseMobileNav, KundeMobileNav } from '../KundeMobileNav';
import { CartContext } from '../../context/cartContextInstance';

const cartValue = {
  items: [],
  count: 3,
  total: 0,
  addItem: vi.fn(),
  setQuantity: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

function renderKunde(initialPath = '/kunde') {
  return render(
    <CartContext.Provider value={cartValue}>
      <MemoryRouter initialEntries={[initialPath]}>
        <KundeMobileNav />
      </MemoryRouter>
    </CartContext.Provider>,
  );
}

describe('KundeMobileNav', () => {
  it('renders five tabs from the shared source plus a Mer button', () => {
    renderKunde();

    for (const label of ['Hjem', 'Ordrer', 'Bestill', 'Statistikk', 'Konto']) {
      expect(screen.getByRole('link', { name: new RegExp(label) })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Mer' })).toBeInTheDocument();
    // Sidebar-only entries live in the sheet, not the tab row.
    expect(screen.queryByRole('link', { name: 'Mine priser' })).not.toBeInTheDocument();
  });

  it('shows the cart count on the Bestill tab', () => {
    renderKunde();
    const bestill = screen.getByRole('link', { name: /Bestill/ });
    expect(within(bestill).getByText('3')).toBeInTheDocument();
  });

  it('marks the active tab with aria-current="page"', () => {
    renderKunde('/kunde/orders');
    expect(screen.getByRole('link', { name: /Ordrer/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Hjem/ })).not.toHaveAttribute('aria-current');
  });

  it('opens the Mer sheet with overflow entries and closes on Escape', async () => {
    const user = userEvent.setup();
    renderKunde();

    await user.click(screen.getByRole('button', { name: 'Mer' }));
    expect(screen.getByRole('dialog', { name: 'Flere sider' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mine priser' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Avansert Analyse' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Flere sider' })).not.toBeInTheDocument();
    });
  });

  it('highlights Mer when an overflow route is active', () => {
    renderKunde('/kunde/pricing');
    const mer = screen.getByRole('button', { name: 'Mer' });
    expect(mer.className).toContain('text-primary-400');
    expect(screen.getByRole('link', { name: /Statistikk/ })).not.toHaveAttribute('aria-current');
  });
});

describe('AnalyseMobileNav', () => {
  it('renders two tabs and no Mer button', () => {
    render(
      <MemoryRouter initialEntries={['/analyse']}>
        <AnalyseMobileNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Statistikk' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mer' })).not.toBeInTheDocument();
  });
});
