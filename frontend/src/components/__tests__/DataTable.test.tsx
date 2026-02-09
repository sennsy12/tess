/**
 * Component tests for <DataTable />
 *
 * Tests cover:
 *  - Basic rendering of rows and columns
 *  - Empty state message
 *  - Sorting (ascending / descending / reset)
 *  - Pagination controls
 *  - Row click callback
 *  - Custom render functions for columns
 */

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable } from '../DataTable';

// ── Helpers ──────────────────────────────────────────────────────────

interface TestRow {
  id: number;
  name: string;
  value: number;
}

const sampleColumns = [
  { key: 'id' as const, header: 'ID' },
  { key: 'name' as const, header: 'Name' },
  { key: 'value' as const, header: 'Value' },
];

const sampleData: TestRow[] = [
  { id: 1, name: 'Alpha', value: 300 },
  { id: 2, name: 'Bravo', value: 100 },
  { id: 3, name: 'Charlie', value: 200 },
];

// ── Tests ────────────────────────────────────────────────────────────

describe('DataTable', () => {
  it('renders column headers', () => {
    render(<DataTable data={sampleData} columns={sampleColumns} />);

    expect(screen.getByText('ID')).toBeInTheDocument();
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders all data rows', () => {
    render(<DataTable data={sampleData} columns={sampleColumns} />);

    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('Bravo')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
  });

  it('shows empty message when data is empty', () => {
    render(<DataTable data={[]} columns={sampleColumns} emptyMessage="No results" />);

    expect(screen.getByText('No results')).toBeInTheDocument();
  });

  it('shows default empty message in Norwegian', () => {
    render(<DataTable data={[]} columns={sampleColumns} />);

    expect(screen.getByText('Ingen data funnet')).toBeInTheDocument();
  });

  it('sorts ascending then descending on column header clicks', async () => {
    render(<DataTable data={sampleData} columns={sampleColumns} />);
    const user = userEvent.setup();

    // Click "Value" header to sort ascending
    await user.click(screen.getByText('Value'));

    const rows = screen.getAllByRole('row');
    // rows[0] is the header row; data starts at rows[1]
    const firstDataRow = rows[1];
    expect(within(firstDataRow).getByText('100')).toBeInTheDocument();

    // Click again to sort descending
    await user.click(screen.getByText('Value'));

    const rowsDesc = screen.getAllByRole('row');
    const firstDataRowDesc = rowsDesc[1];
    expect(within(firstDataRowDesc).getByText('300')).toBeInTheDocument();
  });

  it('resets sort after three clicks on the same column', async () => {
    render(<DataTable data={sampleData} columns={sampleColumns} />);
    const user = userEvent.setup();

    // 1st click → asc, 2nd → desc, 3rd → reset to original order
    await user.click(screen.getByText('Value'));
    await user.click(screen.getByText('Value'));
    await user.click(screen.getByText('Value'));

    // Original order: Alpha (300), Bravo (100), Charlie (200)
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]).getByText('Alpha')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Bravo')).toBeInTheDocument();
  });

  it('calls onRowClick with the correct row when a row is clicked', async () => {
    const handleClick = vi.fn();
    render(<DataTable data={sampleData} columns={sampleColumns} onRowClick={handleClick} />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Bravo'));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleClick).toHaveBeenCalledWith(sampleData[1]);
  });

  it('renders custom column renderers', () => {
    const columnsWithRender = [
      ...sampleColumns.slice(0, 2),
      {
        key: 'value' as const,
        header: 'Value',
        render: (val: number) => <span data-testid="custom">{val} NOK</span>,
      },
    ];

    render(<DataTable data={sampleData} columns={columnsWithRender} />);

    const customCells = screen.getAllByTestId('custom');
    expect(customCells).toHaveLength(3);
    expect(customCells[0].textContent).toBe('300 NOK');
  });

  it('paginates when data exceeds pageSize', () => {
    // Generate 5 rows with pageSize=2
    const manyRows: TestRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: (i + 1) * 10,
    }));

    render(<DataTable data={manyRows} columns={sampleColumns} pageSize={2} />);

    // Should show only 2 rows on page 1
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.queryByText('Item 3')).not.toBeInTheDocument();

    // Pagination info should be visible
    expect(screen.getByText(/Viser 1-2 av 5/)).toBeInTheDocument();
    expect(screen.getByText(/Side 1 av 3/)).toBeInTheDocument();
  });

  it('navigates to next page when next button is clicked', async () => {
    const manyRows: TestRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: (i + 1) * 10,
    }));

    render(<DataTable data={manyRows} columns={sampleColumns} pageSize={2} />);
    const user = userEvent.setup();

    // Click the next page button (»)
    await user.click(screen.getByText('»'));

    expect(screen.getByText('Item 3')).toBeInTheDocument();
    expect(screen.getByText('Item 4')).toBeInTheDocument();
    expect(screen.queryByText('Item 1')).not.toBeInTheDocument();
  });

  it('does not show pagination when all data fits on one page', () => {
    render(<DataTable data={sampleData} columns={sampleColumns} pageSize={50} />);

    expect(screen.queryByText(/Side/)).not.toBeInTheDocument();
  });
});
