import { Request, Response } from 'express';
import fs from 'fs';
import { createDB, truncateDB } from '../etl/dbController.js';
import { generateTestData, insertTestData } from '../etl/testDataController.js';
import { generateRealData, insertRealData } from '../etl/realDataController.js';
import { generateBulkTestData, insertBulkTestData, getTableCounts } from '../etl/bulkDataController.js';
import { uploadCsvToTable } from '../etl/csvUploadController.js';

export const etlController = {
  createDB: async (req: Request, res: Response) => {
    try {
      const result = await createDB();
      res.json({ success: true, message: 'Database tables created successfully', details: result });
    } catch (error: any) {
      console.error('Create DB error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  truncateDB: async (req: Request, res: Response) => {
    try {
      const result = await truncateDB();
      res.json({ success: true, message: 'Database tables truncated successfully', details: result });
    } catch (error: any) {
      console.error('Truncate DB error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  generateTestData: async (req: Request, res: Response) => {
    try {
      const result = await generateTestData();
      res.json({ success: true, message: 'Test data generated successfully', data: result });
    } catch (error: any) {
      console.error('Generate test data error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  insertTestData: async (req: Request, res: Response) => {
    try {
      const result = await insertTestData();
      res.json({ success: true, message: 'Test data inserted successfully', details: result });
    } catch (error: any) {
      console.error('Insert test data error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  generateRealData: async (req: Request, res: Response) => {
    try {
      const result = await generateRealData();
      res.json({ success: true, message: 'Real data generated successfully', data: result });
    } catch (error: any) {
      console.error('Generate real data error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  insertRealData: async (req: Request, res: Response) => {
    try {
      const result = await insertRealData();
      res.json({ success: true, message: 'Real data inserted successfully', details: result });
    } catch (error: any) {
      console.error('Insert real data error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  runFullTestPipeline: async (req: Request, res: Response) => {
    try {
      const results = {
        truncate: await truncateDB(),
        create: await createDB(),
        generate: await generateTestData(),
        insert: await insertTestData(),
      };
      res.json({ success: true, message: 'Full test pipeline completed', details: results });
    } catch (error: any) {
      console.error('Full pipeline error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  generateBulkData: async (req: Request, res: Response) => {
    try {
      const { customers = 1000, orders = 100000, linesPerOrder = 5 } = req.body;
      const result = await generateBulkTestData({ customers, orders, linesPerOrder });
      res.json({ success: true, message: 'Bulk data generated successfully', data: result });
    } catch (error: any) {
      console.error('Generate bulk data error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  insertBulkData: async (req: Request, res: Response) => {
    try {
      const result = await insertBulkTestData();
      res.json({ success: true, message: 'Bulk data inserted successfully', data: result });
    } catch (error: any) {
      console.error('Insert bulk data error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getTableCounts: async (req: Request, res: Response) => {
    try {
      const counts = await getTableCounts();
      res.json({ success: true, counts });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  runBulkPipeline: async (req: Request, res: Response) => {
    try {
      const { customers = 1000, orders = 100000, linesPerOrder = 5 } = req.body;
      
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
    } catch (error: any) {
      console.error('Bulk pipeline error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  },

  uploadCsv: async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { table } = req.body;
    const allowedTables = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

    if (!table || !allowedTables.includes(table)) {
      return res.status(400).json({ error: `Invalid table. Allowed: ${allowedTables.join(', ')}` });
    }

    try {
      const duration = await uploadCsvToTable(table, req.file.path);

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      res.json({ 
        success: true, 
        message: `CSV uploaded to ${table} successfully`,
        duration,
        table
      });
    } catch (error: any) {
      console.error('CSV upload error:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      // Ensure file is deleted even on error
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
