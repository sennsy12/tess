import { Request, Response } from 'express';
import { uploadCsvToTable } from '../../etl/csvUploadController.js';
import { uploadXlsxToTable } from '../../etl/xlsxUploadController.js';
import {
  createIngestJobId,
  enqueueIngestJob,
  executeIngestJob,
  isEtlQueueReady,
} from '../../etl/etlQueue.js';
import { setJobAbortController, clearJobAbortController } from '../../etl/jobRegistry.js';
import { ValidationError } from '../../middleware/errorHandler.js';
import { unlinkIfExists } from '../../lib/fsUtil.js';
import type { EtlIngestBody } from '../../middleware/validation.js';

export const etlIngestHandlers = {
  uploadCsv: async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { table } = req.body as { table?: string };
    const allowedTables = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

    if (table && !allowedTables.includes(table)) {
      throw new ValidationError(`Invalid table. Allowed: ${allowedTables.join(', ')}`);
    }

    const filePath = req.file.path;
    try {
      const { duration, table: detectedTable, rowCount, attemptedRows, rejectedRows } = await uploadCsvToTable(filePath, table);
      const msPerInsertedRow = rowCount > 0 ? Number((duration / rowCount).toFixed(3)) : null;
      const rowsPerSecond = duration > 0 ? Number(((rowCount * 1000) / duration).toFixed(2)) : 0;
      const rowsPerMillisecond = duration > 0 ? Number((rowCount / duration).toFixed(4)) : 0;

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
          rowsPerMillisecond,
          msPerInsertedRow
        },
        details: {
          insertedRows: rowCount,
          attemptedRows,
          rejectedRows,
          durationMs: duration,
          rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow
        }
      });
    } finally {
      await unlinkIfExists(filePath);
    }
  },

  uploadXlsx: async (req: Request, res: Response) => {
    if (!req.file) {
      throw new ValidationError('No file uploaded');
    }

    const { table, sheet } = req.body as { table?: string; sheet?: string };
    const allowedTables = ['ordre', 'ordrelinje', 'kunde', 'vare', 'firma', 'lager'];

    if (table && !allowedTables.includes(table)) {
      throw new ValidationError(`Invalid table. Allowed: ${allowedTables.join(', ')}`);
    }
    if (sheet !== undefined && (typeof sheet !== 'string' || sheet.length === 0 || sheet.length > 100)) {
      throw new ValidationError('Invalid sheet name (max 100 characters)');
    }

    const filePath = req.file.path;
    try {
      const { duration, table: detectedTable, rowCount, attemptedRows, rejectedRows } = await uploadXlsxToTable(filePath, {
        table,
        sheet: sheet || undefined,
      });
      const msPerInsertedRow = rowCount > 0 ? Number((duration / rowCount).toFixed(3)) : null;
      const rowsPerSecond = duration > 0 ? Number(((rowCount * 1000) / duration).toFixed(2)) : 0;
      const rowsPerMillisecond = duration > 0 ? Number((rowCount / duration).toFixed(4)) : 0;

      res.json({
        success: true,
        message: `XLSX lastet opp til ${detectedTable} (${rowCount}/${attemptedRows} rader)`,
        duration,
        table: detectedTable,
        rowCount,
        attemptedRows,
        rejectedRows,
        performance: {
          rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow
        },
        details: {
          insertedRows: rowCount,
          attemptedRows,
          rejectedRows,
          durationMs: duration,
          rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow
        }
      });
    } finally {
      await unlinkIfExists(filePath);
    }
  },

  ingestStream: async (req: Request<object, object, EtlIngestBody>, res: Response) => {
    const body = req.body;
    const {
      sourceType,
      table,
      async: runAsync,
      jobId: providedJobId,
    } = body;

    const shouldUseUploadedFile = sourceType === 'csv' || sourceType === 'xlsx' || (sourceType === 'json' && req.file);
    const uploadedFilePath = req.file?.path;
    if (sourceType === 'csv' && !uploadedFilePath) {
      throw new ValidationError('CSV ingest requires an uploaded file (multipart field name: file)');
    }
    if (sourceType === 'xlsx' && !uploadedFilePath) {
      throw new ValidationError('XLSX ingest requires an uploaded file (multipart field name: file)');
    }
    if (sourceType === 'json' && !uploadedFilePath) {
      throw new ValidationError('JSON ingest requires an uploaded file (multipart field name: file)');
    }

    const jobId = createIngestJobId(providedJobId);

    const payload = {
      jobId,
      body,
      uploadedFilePath: shouldUseUploadedFile ? uploadedFilePath : undefined,
    };

    if (runAsync && isEtlQueueReady()) {
      await enqueueIngestJob(payload);
      res.status(202).json({
        success: true,
        message: `ETL job queued for ${table}`,
        jobId,
        status: 'pending',
        pollUrl: `/api/etl/jobs/${jobId}`,
      });
      return;
    }

    const abortController = new AbortController();
    setJobAbortController(jobId, abortController);

    try {
      const result = await executeIngestJob(payload);

      const msPerInsertedRow =
        result.insertedRows > 0 ? Number((result.durationMs / result.insertedRows).toFixed(3)) : null;
      const rowsPerMillisecond =
        result.durationMs > 0 ? Number((result.insertedRows / result.durationMs).toFixed(4)) : 0;

      res.json({
        success: true,
        message: `Streaming ETL completed for ${result.table}`,
        jobId: result.jobId,
        details: result,
        performance: {
          rowsPerSecond: result.rowsPerSecond,
          rowsPerMillisecond,
          msPerInsertedRow,
        },
      });
    } catch (err) {
      const isAbort = err instanceof DOMException && err.name === 'AbortError';
      if (isAbort) {
        res.status(200).json({
          success: false,
          message: 'Job cancelled',
          jobId,
          cancelled: true,
        });
        return;
      }
      throw err;
    } finally {
      clearJobAbortController(jobId);
    }
  },
};
