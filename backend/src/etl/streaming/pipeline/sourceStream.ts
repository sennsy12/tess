import { ValidationError } from '../../../middleware/errorHandler.js';
import { apiRowSource } from '../sources/apiSource.js';
import { csvRowSource } from '../sources/csvSource.js';
import { jsonRowSource } from '../sources/jsonSource.js';
import { StreamingEtlRequest } from '../types.js';

export type SourceStream = AsyncGenerator<Record<string, unknown>>;

export interface SourceStreamOptions {
  /** Resume state from a loaded checkpoint (skipRows for file sources, nextUrl for API). */
  resumeState?: Record<string, unknown>;
  /** Ref updated by API source with nextUrl so we can save it in checkpoint. */
  resumeStateRef?: { current: Record<string, unknown> };
  /** When aborted, sources and pipeline stop. */
  signal?: AbortSignal;
}

export function getSourceStream(config: StreamingEtlRequest, options: SourceStreamOptions = {}): SourceStream {
  const { resumeState, resumeStateRef, signal } = options;
  const skipRows = typeof resumeState?.skipRows === 'number' ? resumeState.skipRows : 0;

  if (config.sourceType === 'csv') {
    if (!config.csv?.filePath) {
      throw new ValidationError('csv.filePath is required for csv source');
    }
    return csvRowSource(
      config.csv.filePath,
      config.csv.delimiter,
      config.csv.compression ?? 'none',
      { skipRows, signal }
    );
  }

  if (config.sourceType === 'json') {
    if (!config.json?.filePath) {
      throw new ValidationError('json.filePath is required for json source');
    }
    return jsonRowSource(
      config.json.filePath,
      config.json.mode ?? 'array',
      config.json.compression ?? 'none',
      { skipRows, signal }
    );
  }

  if (config.sourceType === 'api') {
    if (!config.api?.url) {
      throw new ValidationError('api.url is required for api source');
    }
    const initialUrl = typeof resumeState?.nextUrl === 'string' ? resumeState.nextUrl : undefined;
    const onResumeState = resumeStateRef
      ? (state: Record<string, unknown>) => {
          resumeStateRef.current = { ...resumeStateRef.current, ...state };
        }
      : undefined;
    return apiRowSource(config.api, { initialUrl, onResumeState, signal });
  }

  throw new ValidationError(`Unsupported source type: ${String(config.sourceType)}`);
}
