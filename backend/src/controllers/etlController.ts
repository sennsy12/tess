import { Request, Response } from 'express';
import fs from 'fs';
import { createDB, truncateDB } from '../etl/dbController.js';
import { generateTestData, insertTestData } from '../etl/testDataController.js';
import { generateRealData, insertRealData } from '../etl/realDataController.js';
import { generateBulkTestData, insertBulkTestData, getTableCounts } from '../etl/bulkDataController.js';
import { uploadCsvToTable } from '../etl/csvUploadController.js';
import { ValidationError } from '../middleware/errorHandler.js';
import { assertAdminActionKey } from '../lib/actionKey.js';

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
    
    console.log('🚀 Starting bulk pipeline...');
    const startTime = Date.now();
    
    const results = {
      truncate: await truncateDB(),
      create: await createDB(),
      generate: await generateBulkTestData({ customers, orders, linesPerOrder }),
      insert: await insertBulkTestData(),
      totalTimeMs: 0,
    };
    
    results.totalTimeMs = Date.now() - startTime;
    console.log(`✅ Bulk pipeline completed in ${results.totalTimeMs}ms`);
    
    res.json({ success: true, message: 'Bulk pipeline completed', details: results });
  },

  uploadCsv: async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { table } = req.body;
    const allowedTables = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

    if (!table || !allowedTables.includes(table)) {
      // Cleanup file before throwing
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw new ValidationError(`Invalid table. Allowed: ${allowedTables.join(', ')}`);
    }

    try {
      const duration = await uploadCsvToTable(table, req.file.path);

      res.json({ 
        success: true, 
        message: `CSV uploaded to ${table} successfully`,
        duration,
        table
      });
    } finally {
      // Ensure file is deleted
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {
          console.error('Failed to delete temp file:', e);
        }
      }
    }
  }
};

