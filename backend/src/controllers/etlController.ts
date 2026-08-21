import { etlDataHandlers } from './etl/data.js';
import { etlBulkHandlers } from './etl/bulk.js';
import { etlIngestHandlers } from './etl/ingest.js';
import { etlJobHandlers } from './etl/jobs.js';

export const etlController = {
  ...etlDataHandlers,
  ...etlBulkHandlers,
  ...etlIngestHandlers,
  ...etlJobHandlers,
};
