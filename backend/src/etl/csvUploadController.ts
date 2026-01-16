import { PoolClient } from 'pg';
import copyStreams from 'pg-copy-streams';
import fs from 'fs';
import { pipeline } from 'stream/promises';
import pool from '../db/index.js';

/**
 * Uploads a CSV file directly to a database table using streaming COPY
 */
export async function uploadCsvToTable(tableName: string, filePath: string): Promise<number> {
  const client: PoolClient = await pool.connect();
  const startTime = Date.now();

  try {
    console.log(`🚀 Starting CSV upload to ${tableName}...`);
    
    const fileStream = fs.createReadStream(filePath);
    const stream = client.query(copyStreams.from(`COPY ${tableName} FROM STDIN WITH (FORMAT csv, HEADER true)`));

    await pipeline(fileStream, stream);

    const duration = Date.now() - startTime;
    console.log(`✅ CSV upload to ${tableName} completed in ${duration}ms`);
    
    return duration;
  } finally {
    client.release();
  }
}
