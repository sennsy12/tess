/**
 * Tests for the bilingual in-app Help page (/hjelp).
 *
 * Covers:
 *  - Norwegian default (localStorage empty) + English toggle with persistence
 *  - Search filters guides, FAQ and glossary
 *  - Role filter hides non-matching guides
 *  - FAQ accordion expands/collapses with aria-expanded
 *  - Recommended banner reflects the signed-in role
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Help } from '../Help';

vi.mock('../../components/Layout', () => ({
  Layout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <div>
      <h2>{title}</h2>
      {children}
    </div>
  ),
}));

const mockUser = vi.fn();

vi.mock('../../context/useAuth', () => ({
  useAuth: () => ({ user: mockUser() }),
}));

function renderHelp() {
  return render(
    <MemoryRouter initialEntries={['/hjelp']}>
      <Help />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockUser.mockReturnValue({ id: 1, username: 'admin', role: 'admin' });
});

describe('Help page', () => {
  it('renders Norwegian by default with guides, FAQ and glossary', () => {
    renderHelp();

    expect(screen.getByText('Hjelp og dokumentasjon')).toBeInTheDocument();
    expect(screen.getByText('Veiledninger')).toBeInTheDocument();
    expect(screen.getByText('Kom i gang')).toBeInTheDocument();
    expect(screen.getByText('Vanlige spørsmål')).toBeInTheDocument();
    expect(screen.getByText('Ordliste')).toBeInTheDocument();
    // Glossary term present in both languages (term itself is stable).
    expect(screen.getByText('Idempotensnøkkel')).toBeInTheDocument();
  });

  it('toggles to English and persists the choice', async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.click(screen.getByRole('button', { name: 'Switch to English' }));

    expect(screen.getByText('Help and documentation')).toBeInTheDocument();
    expect(screen.getByText('Getting started')).toBeInTheDocument();
    expect(screen.getByText('Frequently asked questions')).toBeInTheDocument();
    expect(localStorage.getItem('tess-help-lang')).toBe('en');

    // Toggle back to Norwegian.
    await user.click(screen.getByRole('button', { name: 'Bytt til norsk' }));
    expect(screen.getByText('Hjelp og dokumentasjon')).toBeInTheDocument();
  });

  it('shows a role-specific recommendation banner', () => {
    mockUser.mockReturnValue({ id: 2, username: 'kunde1', role: 'kunde', kundenr: 'K001' });
    renderHelp();

    expect(screen.getByText(/Du er logget inn som kunde/)).toBeInTheDocument();
  });

  it('filters guides by role', async () => {
    const user = userEvent.setup();
    renderHelp();

    // Admin guide visible by default (Alle).
    expect(screen.getByText('Admin: drift og forvaltning')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kunde' }));

    expect(screen.getByText('Kunde: ordrer og bestilling')).toBeInTheDocument();
    expect(screen.queryByText('Admin: drift og forvaltning')).not.toBeInTheDocument();
    expect(screen.queryByText('Analyse: statistikk')).not.toBeInTheDocument();
  });

  it('filters content by free-text search', async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.type(screen.getByLabelText('Søk i hjelpen'), 'idempotens');

    // Glossary still shows the matching term; unrelated guides are hidden.
    expect(screen.getByText('Idempotensnøkkel')).toBeInTheDocument();
    expect(screen.queryByText('Analyse: statistikk')).not.toBeInTheDocument();
  });

  it('shows a no-results hint for nonsense queries', async () => {
    const user = userEvent.setup();
    renderHelp();

    await user.type(screen.getByLabelText('Søk i hjelpen'), 'zzz-ingen-treff-zzz');

    expect(screen.getAllByText(/Ingen treff/).length).toBeGreaterThan(0);
  });

  it('expands FAQ answers as an accordion', async () => {
    const user = userEvent.setup();
    renderHelp();

    const faq = screen.getByRole('button', { name: /Hvorfor kan jeg ikke kansellere/ });
    expect(faq).toHaveAttribute('aria-expanded', 'false');

    await user.click(faq);

    expect(faq).toHaveAttribute('aria-expanded', 'true');
    const panel = document.getElementById('faq-panel-1');
    expect(panel).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText(/Til godkjenning eller Godkjent/),
    ).toBeInTheDocument();
  });

  it('renders shortcut links to real routes', () => {
    renderHelp();

    expect(screen.getByRole('link', { name: /Ordrekø/ })).toHaveAttribute('href', '/admin/approvals');
    expect(screen.getByRole('link', { name: /Status/ })).toHaveAttribute('href', '/admin/status');
  });
});
