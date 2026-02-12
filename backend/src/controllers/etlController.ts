import { Request, Response } from 'express';
import fs from 'fs';
import { createDB, truncateDB } from '../etl/dbController.js';
import { generateTestData, insertTestData } from '../etl/testDataController.js';
import { generateRealData, insertRealData } from '../etl/realDataController.js';
import { generateBulkTestData, insertBulkTestData, getTableCounts } from '../etl/bulkDataController.js';
import { uploadCsvToTable } from '../etl/csvUploadController.js';
import { runStreamingEtl } from '../etl/streaming/pipeline.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { assertAdminActionKey } from '../lib/actionKey.js';
import { etlLogger } from '../lib/logger.js';

export const etlController = {
  createDB: async (req: Request, res: Response) => {
    const result = await createDB();
    res.json({ success: true, message: 'Database tables created successfully', details: result });
  },

  truncateDB: async (req: Request, res: Response) => {
    const result = await truncateDB();
    res.json({ success: true, message: 'Database tables truncated successfully', details: result });
  },

  generateTestData: async (req: Request, res: Response) => {
    const result = await generateTestData();
    res.json({ success: true, message: 'Test data generated successfully', data: result });
  },

  insertTestData: async (req: Request, res: Response) => {
    const result = await insertTestData();
    res.json({ success: true, message: 'Test data inserted successfully', details: result });
  },

  generateRealData: async (req: Request, res: Response) => {
    const result = await generateRealData();
    res.json({ success: true, message: 'Real data generated successfully', data: result });
  },

  insertRealData: async (req: Request, res: Response) => {
    const result = await insertRealData();
    res.json({ success: true, message: 'Real data inserted successfully', details: result });
  },

  runFullTestPipeline: async (req: Request, res: Response) => {
    const results = {
      truncate: await truncateDB(),
      create: await createDB(),
      generate: await generateTestData(),
      insert: await insertTestData(),
    };
    res.json({ success: true, message: 'Full test pipeline completed', details: results });
  },

  generateBulkData: async (req: Request, res: Response) => {
    const { customers = 1000, orders = 100000, linesPerOrder = 5, actionKey } = req.body;
    const estimatedLines = orders * linesPerOrder;

    if (estimatedLines > 1_000_000) {
      assertAdminActionKey(actionKey, 'bulk data generation over 1,000,000 rows');
    }

    const result = await generateBulkTestData({ customers, orders, linesPerOrder });
    res.json({ success: true, message: 'Bulk data generated successfully', data: result });
  },

  insertBulkData: async (req: Request, res: Response) => {
    const result = await insertBulkTestData();
    res.json({ success: true, message: 'Bulk data inserted successfully', data: result });
  },

  getTableCounts: async (req: Request, res: Response) => {
    const counts = await getTableCounts();
    res.json({ success: true, counts });
  },

  runBulkPipeline: async (req: Request, res: Response) => {
    const { customers = 1000, orders = 100000, linesPerOrder = 5, actionKey } = req.body;
    const estimatedLines = orders * linesPerOrder;

    if (estimatedLines > 1_000_000) {
      assertAdminActionKey(actionKey, 'bulk pipeline over 1,000,000 rows');
    }
    
    etlLogger.info({ stage: 'bulk-pipeline-start' }, 'Starting bulk pipeline');
    const startTime = Date.now();
    
    const results = {
      truncate: await truncateDB(),
      create: await createDB(),
      generate: await generateBulkTestData({ customers, orders, linesPerOrder }),
      insert: await insertBulkTestData(),
      totalTimeMs: 0,
    };
    
    results.totalTimeMs = Date.now() - startTime;
    etlLogger.info({ stage: 'bulk-pipeline-complete', durationMs: results.totalTimeMs }, 'Bulk pipeline completed');
    
    res.json({ success: true, message: 'Bulk pipeline completed', details: results });
  },

  uploadCsv: async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { table } = req.body;
    const allowedTables = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

    if (table && !allowedTables.includes(table)) {
      // Cleanup file before throwing
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw new ValidationError(`Invalid table. Allowed: ${allowedTables.join(', ')}`);
    }

    try {
      const { duration, table: detectedTable, rowCount, attemptedRows, rejectedRows } = await uploadCsvToTable(req.file.path, table);
      const msPerInsertedRow = rowCount > 0 ? Number((duration / rowCount).toFixed(3)) : null;
      const rowsPerSecond = duration > 0 ? Number(((rowCount * 1000) / duration).toFixed(2)) : 0;

      res.json({ 
        success: true, 
        message: `CSV lastet opp til ${detectedTable} (${rowCount}/${attemptedRows} rader)`,
        duration,
        table: detectedTable,
        rowCount,
        attemptedRows,
        rejectedRows,
        performance: {
          rowsPerSecond,
          msPerInsertedRow
        },
        details: {
          insertedRows: rowCount,
          attemptedRows,
          rejectedRows,
          durationMs: duration,
          rowsPerSecond,
          msPerInsertedRow
        }
      });
    } finally {
      // Ensure file is deleted
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          etlLogger.warn({ error: (e as Error).message }, 'Failed to delete temp file');
        }
      }
    }
  },

  ingestStream: async (req: Request, res: Response) => {
    const {
      sourceType,
      table,
      strictMode = false,
      onConflict = 'nothing',
      sourceMapping,
      csv,
      json,
      api,
    } = req.body;

    const shouldUseUploadedFile = sourceType === 'csv' || (sourceType === 'json' && req.file);
    const uploadedFilePath = req.file?.path;
    if (sourceType === 'csv' && !uploadedFilePath) {
      throw new ValidationError('CSV ingest requires an uploaded file (multipart field name: file)');
    }

    try {
      const result = await runStreamingEtl({
        sourceType,
        table,
        strictMode,
        onConflict,
        sourceMapping,
        csv: sourceType === 'csv'
          ? {
              filePath: uploadedFilePath as string,
              delimiter: csv?.delimiter,
            }
          : undefined,
        json: sourceType === 'json'
          ? {
              mode: json?.mode ?? 'array',
              filePath: uploadedFilePath || json?.filePath,
            }
          : undefined,
        api: sourceType === 'api' ? api : undefined,
      });

      const msPerInsertedRow = result.insertedRows > 0
        ? Number((result.durationMs / result.insertedRows).toFixed(3))
        : null;

      res.json({
        success: true,
        message: `Streaming ETL completed for ${result.table}`,
        details: result,
        performance: {
          rowsPerSecond: result.rowsPerSecond,
          msPerInsertedRow,
        },
      });
    } finally {
      if (shouldUseUploadedFile && uploadedFilePath && fs.existsSync(uploadedFilePath)) {
        try {
          fs.unlinkSync(uploadedFilePath);
        } catch (error) {
          etlLogger.warn({ error: (error as Error).message }, 'Failed to delete temp ingest file');
        }
      }
    }
  }
};

