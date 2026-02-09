/**
 * Mock for the database module (src/db/index.ts)
 * Provides jest.fn() stubs for all exported database functions.
 */

export const query = jest.fn();
export const getClient = jest.fn();
export const transaction = jest.fn();
export const batchInsert = jest.fn();
export const bulkCopy = jest.fn();
export const getPoolStats = jest.fn();

const pool = {
  query: jest.fn(),
  connect: jest.fn(),
  totalCount: 0,
  idleCount: 0,
  waitingCount: 0,
};

export default pool;
