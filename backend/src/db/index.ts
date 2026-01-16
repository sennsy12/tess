import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Optimized pool configuration for high-throughput
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tess',
  // Maximum number of clients in the pool
  max: 20,
  // Minimum number of idle clients
  min: 5,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,
  // Return error after 10 seconds if connection cannot be established
  connectionTimeoutMillis: 10000,
  // Maximum time a query can run before timing out (5 minutes for large operations)
  statement_timeout: 300000,
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  console.log('📦 Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Execute a single query
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) { // Only log slow queries
    console.log('Slow query', { text: text.substring(0, 50), duration, rows: res.rowCount });
  }
  return res;
};

/**
 * Get a client for transaction or batch operations
 */
export const getClient = () => pool.connect();

/**
 * Execute multiple queries in a transaction
 */
export const transaction = async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Batch insert using unnest for high performance
 * This is much faster than individual inserts
 */
export const batchInsert = async (
  tableName: string,
  columns: string[],
  rows: any[][],
  batchSize: number = 10000
): Promise<number> => {
  if (rows.length === 0) return 0;
  
  let totalInserted = 0;
  
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    
    // Build parameterized query with multiple value sets
    const placeholders = batch.map((_, rowIndex) => {
      const rowPlaceholders = columns.map((_, colIndex) => 
        `$${rowIndex * columns.length + colIndex + 1}`
      );
      return `(${rowPlaceholders.join(', ')})`;
    }).join(', ');
    
    const flatValues = batch.flat();
    
    const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
    
    const result = await pool.query(sql, flatValues);
    totalInserted += result.rowCount || 0;
  }
  
  return totalInserted;
};

/**
 * Bulk insert using COPY for maximum performance (10x faster than batch insert)
 */
export const bulkCopy = async (
  tableName: string,
  columns: string[],
  data: string // Tab-separated values
): Promise<void> => {
  const client = await pool.connect();
  try {
    const copyStream = require('pg-copy-streams');
    const stream = client.query(copyStream.from(`COPY ${tableName} (${columns.join(', ')}) FROM STDIN`));
    
    return new Promise((resolve, reject) => {
      stream.on('error', reject);
      stream.on('finish', resolve);
      stream.write(data);
      stream.end();
    });
  } finally {
    client.release();
  }
};

/**
 * Get pool statistics for monitoring
 */
export const getPoolStats = () => ({
  totalCount: pool.totalCount,
  idleCount: pool.idleCount,
  waitingCount: pool.waitingCount,
});

export default pool;
