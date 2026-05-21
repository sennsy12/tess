import type { EtlPipelineJob } from '../types/etlJob';
import { getAuthToken } from './auth/tokenStore';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Subscribe to ETL job progress via SSE using fetch (supports Bearer auth).
 * EventSource cannot send Authorization headers.
 */
export function subscribeEtlJobProgress(
  jobId: string,
  onProgress: (job: EtlPipelineJob) => void,
  onError?: (error: Error) => void,
): () => void {
  const controller = new AbortController();
  const token = getAuthToken();

  void (async () => {
    try {
      const res = await fetch(`${API_URL}/etl/jobs/${encodeURIComponent(jobId)}/progress`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`Kunne ikke koble til fremdrift (${res.status})`);
      }
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error('Ingen respons fra server');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (!payload) continue;
            try {
              onProgress(JSON.parse(payload) as EtlPipelineJob);
            } catch {
              // ignore malformed frames
            }
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  })();

  return () => controller.abort();
}
