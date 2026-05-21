import { AppError } from '../../middleware/errorHandler.js';
import type { CompletionParams } from './types.js';

interface OpenAiChatResponse {
  choices?: Array<{ message?: { content?: string | null } }>;
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
    throw new AppError('Kunne ikke nå AI-tjenesten. Prøv igjen senere.', 502);
  }

  const reply = data.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    throw new AppError('Tomt svar fra assistenten.', 502);
  }

  return reply;
}
