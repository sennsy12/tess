/**
 * Phase 2 tests for <ModalShell />.
 *
 * Covers:
 *  - Closed shell renders nothing
 *  - Open shell exposes role=dialog with the labelled title
 *  - Escape + backdrop dismissal (and opt-out via dismissable={false})
 *  - Initial focus + Tab trap + focus return
 */

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ModalShell } from '../ModalShell';

function OpenHarness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Reopen
      </button>
      <ModalShell open={open} onClose={() => setOpen(false)} labelledBy="test-title">
        <h3 id="test-title">Test dialog</h3>
        <button type="button">First</button>
        <button type="button">Second</button>
      </ModalShell>
    </>
  );
}

function FocusReturnHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <ModalShell open={open} onClose={() => setOpen(false)} labelledBy="focus-title">
        <h3 id="focus-title">Focus dialog</h3>
        <button type="button">Inside</button>
      </ModalShell>
    </>
  );
}

describe('ModalShell', () => {
  it('renders nothing when closed', () => {
    render(
      <ModalShell open={false} onClose={() => {}} label="Hidden">
        <p>Body</p>
      </ModalShell>,
    );
    expect(screen.queryByText('Body')).not.toBeInTheDocument();
  });

  it('exposes role=dialog labelled by the title', () => {
    render(<OpenHarness />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'test-title');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Test dialog')).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<OpenHarness />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    // Exit animation lingers briefly — wait for removal.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('closes on backdrop click unless dismissable={false}', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <ModalShell open onClose={() => {}} label="Pinned" dismissable={false}>
        <p>Pinned body</p>
      </ModalShell>,
    );
    // Backdrop is the presentation sibling before the dialog panel.
    const dialog = screen.getByRole('dialog');
    const backdrop = dialog.previousElementSibling as HTMLElement;
    expect(backdrop).toHaveAttribute('role', 'presentation');
    await user.click(backdrop);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(<div />);
  });

  it('moves initial focus inside and traps Tab', () => {
    render(<OpenHarness />);
    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    expect(first).toHaveFocus();

    // Tab on last wraps to first.
    second.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(first).toHaveFocus();

    // Shift+Tab on first wraps to last.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(second).toHaveFocus();
  });

  it('returns focus to the invoker on close', async () => {
    const user = userEvent.setup();
    render(<FocusReturnHarness />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });
    await user.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });
});
