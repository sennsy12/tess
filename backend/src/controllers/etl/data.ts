import { Request, Response } from 'express';
import { createDB, truncateDB } from '../../etl/dbController.js';
import { generateTestData, insertTestData } from '../../etl/testDataController.js';
import { generateRealData, insertRealData } from '../../etl/realDataController.js';

export const etlDataHandlers = {
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
};
