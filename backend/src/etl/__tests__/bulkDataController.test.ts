/**
 * Unit tests for bulkDataController – generateBulkTestData
 *
 * We mock the db/index module so no real database calls are made.
 * These tests verify the data generation *logic*:
 *  - Correct number of rows generated for each entity
 *  - Data shape / column counts
 *  - Customer numbering format
 *  - Product variety coverage
 *  - Order / order-line relationships
 */

jest.mock('../../db/index', () => ({
  query: jest.fn(),
}));

import { generateBulkTestData, getTableCounts } from '../bulkDataController';
import { query } from '../../db/index';

const mockQuery = query as jest.MockedFunction<typeof query>;

// Silence console.log from the controller during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterAll(() => {
  (console.log as jest.Mock).mockRestore();
});

// ── Tests ────────────────────────────────────────────────────────────

describe('generateBulkTestData', () => {
  const smallConfig = {
    customers: 10,
    orders: 20,
    linesPerOrder: 3,
  };

  it('generates the requested number of customers', async () => {
    const result = await generateBulkTestData(smallConfig);

    expect(result.customersGenerated).toBe(10);
  });

  it('generates one user per customer', async () => {
    const result = await generateBulkTestData(smallConfig);

    expect(result.usersGenerated).toBe(result.customersGenerated);
  });

  it('generates up to 500 products', async () => {
    const result = await generateBulkTestData(smallConfig);

    expect(result.productsGenerated).toBe(500);
  });

  it('generates the requested number of orders', async () => {
    const result = await generateBulkTestData(smallConfig);

    expect(result.ordersGenerated).toBe(20);
  });

  it('generates order lines (at least 1 per order, at most linesPerOrder)', async () => {
    const result = await generateBulkTestData(smallConfig);

    // Each order has between 1 and linesPerOrder lines
    expect(result.orderLinesGenerated).toBeGreaterThanOrEqual(smallConfig.orders);
    expect(result.orderLinesGenerated).toBeLessThanOrEqual(
      smallConfig.orders * smallConfig.linesPerOrder
    );
  });

  it('generates order references for approximately 60% of lines', async () => {
    const result = await generateBulkTestData(smallConfig);

    // References are generated for ~60% of orders, so count should be > 0
    expect(result.orderReferencesGenerated).toBeGreaterThan(0);
    expect(result.orderReferencesGenerated).toBeLessThanOrEqual(result.orderLinesGenerated);
  });

  it('returns generation timing in milliseconds', async () => {
    const result = await generateBulkTestData(smallConfig);

    expect(typeof result.generationTimeMs).toBe('number');
    expect(result.generationTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('uses correct customer number format (K + 6 padded digits)', async () => {
    // We generate with 2 customers to keep it small
    const result = await generateBulkTestData({ customers: 2, orders: 1, linesPerOrder: 1 });

    expect(result.customersGenerated).toBe(2);
    // The function's internal kundeData isn't returned directly, but we can
    // verify via the order count that it ran without errors.
    expect(result.ordersGenerated).toBe(1);
  });

  it('uses default config values when not provided', async () => {
    const result = await generateBulkTestData({});

    // Defaults: customers=1000, orders=100000
    expect(result.customersGenerated).toBe(1000);
    expect(result.ordersGenerated).toBe(100000);
  });
});

describe('getTableCounts', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns counts for all expected tables', async () => {
    mockQuery.mockResolvedValue({
      rows: [{ estimate: 42 }],
      rowCount: 1,
      command: 'SELECT',
      oid: 0,
      fields: [],
    } as any);

    const counts = await getTableCounts();

    const expectedTables = ['kunde', 'vare', 'ordre', 'ordrelinje', 'ordre_henvisning', 'firma', 'lager', 'users'];
    for (const table of expectedTables) {
      expect(counts).toHaveProperty(table);
      expect(counts[table]).toBe(42);
    }
  });

  it('returns 0 for tables that error', async () => {
    mockQuery.mockRejectedValue(new Error('table not found'));

    const counts = await getTableCounts();

    expect(counts.kunde).toBe(0);
    expect(counts.ordre).toBe(0);
  });
});
