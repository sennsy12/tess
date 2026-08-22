import fs from 'fs/promises';
import path from 'path';
import { EtlCheckpoint } from './streaming/types.js';

const CHECKPOINT_DIR = process.env.ETL_CHECKPOINT_DIR || path.join(process.cwd(), '.etl-checkpoints');

async function ensureDir(): Promise<void> {
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
}

/**
 * Persist a checkpoint atomically (write to temp file + rename) so a crash
 * mid-write can never leave a truncated/corrupt JSON behind — a corrupt file
 * would silently disable resume via loadCheckpoint's catch-all.
 */
export async function saveCheckpoint(checkpoint: EtlCheckpoint): Promise<string> {
  await ensureDir();
  const filePath = path.join(CHECKPOINT_DIR, `checkpoint-${checkpoint.jobId}.json`);
  const tmpPath = `${filePath}.${process.pid}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(checkpoint, null, 0), 'utf-8');
  await fs.rename(tmpPath, filePath);
  return filePath;
}

/**
 * Load a checkpoint for resume. Checkpoints without `v: 2` predate committed-
 * boundary checkpointing and recorded uncommitted row counts; honouring them
 * would skip rows, so they are deleted and ignored.
 */
export async function loadCheckpoint(jobId: string): Promise<EtlCheckpoint | null> {
  const filePath = path.join(CHECKPOINT_DIR, `checkpoint-${jobId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data) as EtlCheckpoint;
    if (parsed?.v !== 2) {
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function deleteCheckpoint(jobId: string): Promise<void> {
  const filePath = path.join(CHECKPOINT_DIR, `checkpoint-${jobId}.json`);
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}
