import { withRetry, isRetryableHttpStatus } from '../../lib/asyncUtils.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { CompletionParams } from './types.js';

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
}

export async function completeWithOpenAi(params: CompletionParams): Promise<string> {
  const body = {
    model: params.model,
    temperature: 0.2,
    max_tokens: params.maxOutputTokens,
    messages: [
      { role: 'system', content: params.systemPrompt },
      ...params.messages.map((m) => ({ role: m.role, content: m.content })),
    ],
  };

  return withRetry(
    async () => {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${params.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(60_000),
      });

      const data = (await response.json()) as OpenAiChatResponse;

      if (!response.ok) {
        throw new AppError(
          'Kunne ikke nå AI-tjenesten. Prøv igjen senere.',
          isRetryableHttpStatus(response.status) ? 502 : response.status,
        );
      }

      const reply = data.choices?.[0]?.message?.content?.trim();
      if (!reply) {
        throw new AppError('Tomt svar fra assistenten.', 502);
      }

      return reply;
    },
    { attempts: 3, backoffMs: 500 },
  );
}
