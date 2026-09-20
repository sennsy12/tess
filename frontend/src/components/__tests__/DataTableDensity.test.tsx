/**
 * Regression tests for the DataTable density toggle («Normal/Kompakt»).
 *
 * The toggle was already wired (state + localStorage + compact cell classes)
 * but shipped without tests. These lock in the behaviour:
 *  - the segmented control renders in the toolbar (requires
 *    `enableColumnManagement` + `storageKey`)
 *  - choosing Kompakt applies the compact cell classes and persists to
 *    localStorage under `${storageKey}:density`
 *  - a persisted choice is restored on mount
 */
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataTable } from '../DataTable';

interface Row {
  id: number;
  name: string;
  value: number;
}

const columns = [
  { key: 'id' as const, header: 'ID' },
  { key: 'name' as const, header: 'Name' },
  { key: 'value' as const, header: 'Value' },
];

const data: Row[] = [
  { id: 1, name: 'Alpha', value: 300 },
  { id: 2, name: 'Bravo', value: 100 },
];

const STORAGE_KEY = 'table:test';

function renderTable() {
  return render(
    <DataTable<Row>
      data={data}
      columns={columns}
      paginate={false}
      enableColumnManagement
      storageKey={STORAGE_KEY}
    />,
  );
}

const densityGroup = () =>
  screen.getByRole('group', { name: 'Tabelltetthet' });

describe('DataTable density toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders the Normal/Kompakt segmented control in the toolbar', () => {
    renderTable();
    const group = densityGroup();
    expect(within(group).getByRole('button', { name: 'Normal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(group).getByRole('button', { name: 'Kompakt' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('applies compact cell classes and persists the choice', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(within(densityGroup()).getByRole('button', { name: 'Kompakt' }));

    expect(within(densityGroup()).getByRole('button', { name: 'Kompakt' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Compact density = the smaller text-xs cell treatment.
    const firstCell = screen.getAllByRole('cell')[0];
    expect(firstCell.className).toContain('text-xs');
    // Persisted per table so the choice survives reloads and other tables
    // with the same storageKey keep their own setting.
    expect(localStorage.getItem(`${STORAGE_KEY}:density`)).toBe('compact');
  });

  it('restores a persisted compact choice on mount', () => {
    localStorage.setItem(`${STORAGE_KEY}:density`, 'compact');
    renderTable();

    expect(
      within(densityGroup()).getByRole('button', { name: 'Kompakt' }),
    ).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('cell')[0].className).toContain('text-xs');
    // …and switching back to Normal clears the persisted value's effect.
    expect(
      within(densityGroup()).getByRole('button', { name: 'Normal' }),
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
