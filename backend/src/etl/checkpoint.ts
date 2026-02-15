import fs from 'fs/promises';
import path from 'path';
import { EtlCheckpoint } from './streaming/types.js';

const CHECKPOINT_DIR = process.env.ETL_CHECKPOINT_DIR || path.join(process.cwd(), '.etl-checkpoints');

async function ensureDir(): Promise<void> {
  await fs.mkdir(CHECKPOINT_DIR, { recursive: true });
}

export async function saveCheckpoint(checkpoint: EtlCheckpoint): Promise<string> {
  await ensureDir();
  const filePath = path.join(CHECKPOINT_DIR, `checkpoint-${checkpoint.jobId}.json`);
  await fs.writeFile(filePath, JSON.stringify(checkpoint, null, 0), 'utf-8');
  return filePath;
}

export async function loadCheckpoint(jobId: string): Promise<EtlCheckpoint | null> {
  const filePath = path.join(CHECKPOINT_DIR, `checkpoint-${jobId}.json`);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data) as EtlCheckpoint;
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
