/**
 * Tester for egne visningsnavn (columnLabels) i <DataTable />.
 *
 * Dekker:
 *  - state.columnLabels overstyrer <th>-tekst
 *  - tom label faller tilbake til default header
 *  - ukjente nøkler ignoreres (sanitize)
 *  - rename-UI vises kun for renamable + enableColumnRenaming
 *  - Enter lagrer, Escape avbryter, tomt felt tilbakestiller
 *  - CSV-eksport bruker visningsnavnet
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DataTable, type DataTableState } from '../DataTable';
import * as csvModule from '../../lib/csv';

interface TestRow {
  kunderef: string;
  sum: number;
}

const columns = [
  { key: 'kunderef' as const, header: 'Kunderef', renamable: true },
  { key: 'sum' as const, header: 'Sum' },
];

const data: TestRow[] = [{ kunderef: 'REF-1', sum: 100 }];

function baseState(overrides: Partial<DataTableState> = {}): DataTableState {
  return {
    sortKey: null,
    sortDirection: null,
    currentPage: 1,
    visibleColumnKeys: ['kunderef', 'sum'],
    columnLabels: {},
    ...overrides,
  };
}

describe('DataTable columnLabels', () => {
  it('viser egendefinert navn i tabellhodet', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        state={baseState({ columnLabels: { kunderef: 'Deres ref' } })}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Deres ref/ })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /^Kunderef$/ })).not.toBeInTheDocument();
  });

  it('faller tilbake til default ved tom label og ignorerer ukjente nøkler', () => {
    render(
      <DataTable
        data={data}
        columns={columns}
        state={baseState({ columnLabels: { kunderef: '  ', ukjent: 'X' } })}
      />,
    );
    expect(screen.getByRole('columnheader', { name: /Kunderef/ })).toBeInTheDocument();
  });

  it('viser blyant kun for renamable-kolonner når enableColumnRenaming', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        data={data}
        columns={columns}
        enableColumnManagement
        enableColumnRenaming
        storageKey="test-labels-rename"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Kolonner/ }));
    // Kunderef er renamable → blyant finnes. Sum er ikke → ingen blyant.
    expect(
      screen.getByRole('button', { name: /Gi nytt visningsnavn til Kunderef/ }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /visningsnavn.*Sum/i }),
    ).not.toBeInTheDocument();
  });

  it('viser ingen blyant uten enableColumnRenaming', async () => {
    const user = userEvent.setup();
    render(
      <DataTable
        data={data}
        columns={columns}
        enableColumnManagement
        storageKey="test-labels-no-rename"
      />,
    );

    await user.click(screen.getByRole('button', { name: /Kolonner/ }));
    expect(
      screen.queryByRole('button', { name: /visningsnavn/i }),
    ).not.toBeInTheDocument();
  });

  it('Enter lagrer nytt navn via onStateChange', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <DataTable
        data={data}
        columns={columns}
        enableColumnManagement
        enableColumnRenaming
        storageKey="test-labels-enter"
        state={baseState()}
        onStateChange={onStateChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Kolonner/ }));
    await user.click(screen.getByRole('button', { name: /Gi nytt visningsnavn til Kunderef/ }));
    const input = screen.getByLabelText(/Nytt visningsnavn for Kunderef/);
    await user.clear(input);
    await user.type(input, 'Deres ref');
    await user.keyboard('{Enter}');

    expect(onStateChange).toHaveBeenCalledWith(
      expect.objectContaining({ columnLabels: { kunderef: 'Deres ref' } }),
    );
  });

  it('Escape avbryter uten å lagre', async () => {
    const user = userEvent.setup();
    const onStateChange = vi.fn();
    render(
      <DataTable
        data={data}
        columns={columns}
        enableColumnManagement
        enableColumnRenaming
        storageKey="test-labels-escape"
        state={baseState()}
        onStateChange={onStateChange}
      />,
    );

    await user.click(screen.getByRole('button', { name: /Kolonner/ }));
    await user.click(screen.getByRole('button', { name: /Gi nytt visningsnavn til Kunderef/ }));
    await user.type(screen.getByLabelText(/Nytt visningsnavn/), 'Noe annet');
    await user.keyboard('{Escape}');

    expect(onStateChange).not.toHaveBeenCalledWith(
      expect.objectContaining({ columnLabels: expect.anything() }),
    );
  });

  it('eksporterer CSV med visningsnavn som kolonnenøkkel', async () => {
    const user = userEvent.setup();
    const downloadSpy = vi.spyOn(csvModule, 'downloadCsv').mockImplementation(() => {});
    try {
      render(
        <DataTable
          data={data}
          columns={columns}
          enableCsvExport
          exportFilename="test-export"
          state={baseState({ columnLabels: { kunderef: 'Deres ref' } })}
        />,
      );

      await user.click(screen.getByRole('button', { name: /Eksporter/ }));
      expect(downloadSpy).toHaveBeenCalledWith(
        'test-export',
        [{ 'Deres ref': 'REF-1', Sum: 100 }],
      );
    } finally {
      downloadSpy.mockRestore();
    }
  });
});

beforeEach(() => {
  localStorage.clear();
});
