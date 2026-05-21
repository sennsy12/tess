import fs from 'fs/promises';
import { logger } from './logger.js';

/** Async unlink; ignores ENOENT. */
export async function unlinkIfExists(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code !== 'ENOENT') {
      logger.warn({ err: err.message, path: filePath }, 'Failed to delete file');
    }
  }
}
