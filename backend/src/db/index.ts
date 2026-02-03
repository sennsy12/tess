import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { dbLogger } from '../lib/logger.js';

dotenv.config();

// Optimized pool configuration for high-throughput
const poolConfig: PoolConfig = {
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tess',
  // Maximum number of clients in the pool (increased for parallel COPY)
  max: 50,
  // Minimum number of idle clients
  min: 10,
  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,
  // Return error after 10 seconds if connection cannot be established
  connectionTimeoutMillis: 10000,
  // Maximum time a query can run before timing out (5 minutes for large operations)
  statement_timeout: 300000,
};

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  dbLogger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  dbLogger.error({ error: err.message }, 'Unexpected error on idle client');
});

/**
 * Execute a single query
 */
export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 100) { // Only log slow queries
    dbLogger.warn({ query: text.substring(0, 100), duration, rows: res.rowCount }, 'Slow query detected');
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
 * Bulk insert using COPY for maximum performance (5-10x faster than batch insert)
 * Accepts array of arrays (rows) and converts to tab-separated format
 */
export const bulkCopy = async (
  tableName: string,
  columns: string[],
  rows: any[][],
  onConflict: 'nothing' | 'error' = 'nothing'
): Promise<number> => {
  if (rows.length === 0) return 0;

  const client = await pool.connect();
  try {
    const copyStreams = await import('pg-copy-streams');
    
    // Use a temp table for ON CONFLICT DO NOTHING support
    const tempTable = `temp_${tableName}_${Date.now()}`;
    
    // Start transaction to keep temp table alive
    await client.query('BEGIN');
    
    if (onConflict === 'nothing') {
      // Create temp table with same structure (no constraints to speed up COPY)
      // EXCEPT for SERIAL columns which should be excluded from the COPY if not provided
      await client.query(`CREATE TEMP TABLE ${tempTable} (LIKE ${tableName} INCLUDING DEFAULTS) ON COMMIT DROP`);
      
      // If the table has an 'id' column that is a serial, we might need to handle it
      // For the users table, the 'id' column is SERIAL and NOT NULL.
      // When we CREATE TEMP TABLE ... LIKE ..., the NOT NULL constraint is copied.
      // If we don't provide 'id' in the COPY, it fails.
      // Let's remove the NOT NULL constraint from the temp table for the columns we are NOT copying
      const allColsResult = await client.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${tableName}'
      `);
      const allCols = allColsResult.rows.map((r: any) => r.column_name);
      const missingCols = allCols.filter((c: string) => !columns.includes(c));
      
      for (const col of missingCols) {
        await client.query(`ALTER TABLE ${tempTable} ALTER COLUMN ${col} DROP NOT NULL`);
      }
    }
    
    const targetTable = onConflict === 'nothing' ? tempTable : tableName;
    
    const stream = client.query(
      copyStreams.from(`COPY ${targetTable} (${columns.join(', ')}) FROM STDIN WITH (FORMAT text, NULL '\\N')`)
    );

    const copyResult = await new Promise<number>((resolve, reject) => {
      stream.on('error', (err: Error) => {
        reject(err);
      });

      stream.on('finish', async () => {
        try {
          if (onConflict === 'nothing') {
            // Insert from temp to real table with ON CONFLICT DO NOTHING
            const result = await client.query(`
              INSERT INTO ${tableName} (${columns.join(', ')})
              SELECT ${columns.join(', ')} FROM ${tempTable}
              ON CONFLICT DO NOTHING
            `);
            resolve(result.rowCount || 0);
          } else {
            resolve(rows.length);
          }
        } catch (err) {
          reject(err);
        }
      });

      // Convert rows to tab-separated text and write to stream
      // Process in chunks to avoid memory issues
      const CHUNK_SIZE = 50000;
      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        const text = chunk.map(row => 
          row.map((val: any) => {
            if (val === null || val === undefined) return '\\N';
            // Escape special characters for COPY format
            return String(val)
              .replace(/\\/g, '\\\\')
              .replace(/\t/g, '\\t')
              .replace(/\n/g, '\\n')
              .replace(/\r/g, '\\r');
          }).join('\t')
        ).join('\n') + '\n';
        
        stream.write(text);
      }
      
      stream.end();
    });

    await client.query('COMMIT');
    return copyResult;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
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
