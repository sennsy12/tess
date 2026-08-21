import { withRetry, isRetryableHttpStatus } from '../../lib/asyncUtils.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { CompletionParams } from './types.js';

interface GeminiGenerateResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

/**
 * Google Gemini (e.g. gemini-2.5-flash-lite) — typically cheaper than GPT-4o-mini.
 * @see https://ai.google.dev/gemini-api/docs
 */
export async function completeWithGemini(params: CompletionParams): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

  const body = {
    systemInstruction: {
      parts: [{ text: params.systemPrompt }],
    },
    contents: params.messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: params.maxOutputTokens,
    },
  };

  return withRetry(
    async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      const data = (await response.json()) as GeminiGenerateResponse;

      if (!response.ok) {
        const detail = data.error?.message;
        const message =
          process.env.NODE_ENV === 'development' && detail
            ? `AI-tjeneste feilet: ${detail}`
            : 'Kunne ikke nå AI-tjenesten. Prøv igjen senere.';
        const error = new AppError(message, isRetryableHttpStatus(response.status) ? 502 : response.status);
        throw error;
      }

      const reply = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('').trim();
      if (!reply) {
        throw new AppError('Tomt svar fra assistenten.', 502);
      }

      return reply;
    },
    { attempts: 3, backoffMs: 500 },
  );
}
