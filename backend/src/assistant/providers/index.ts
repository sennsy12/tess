import { AppError } from '../../middleware/errorHandler.js';
import { logger } from '../../lib/logger.js';
import { getAssistantConfig } from '../config.js';
import type { ChatMessage } from '../types.js';
import { completeWithGemini } from './gemini.js';
import { completeWithOpenAi } from './openai.js';

export const ASSISTANT_TIMEOUT_MESSAGE = 'Assistenten brukte for lang tid. Prøv igjen.';

/**
 * Race a promise against a timeout. On timeout rejects with a 504 AppError.
 * The `label` is only used for debugging — never interpolated into the
 * user-facing message and never logged with secrets.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'Assistant'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new AppError(ASSISTANT_TIMEOUT_MESSAGE, 504));
    }, ms);
  });
  // Avoid unhandled rejection warnings on the loser of the race: the handlers
  // attached here settle the race outcome while the original promise still
  // settles independently.
  void promise.then(
    () => {
      if (timer !== undefined) clearTimeout(timer);
    },
    () => {
      if (timer !== undefined) clearTimeout(timer);
    },
  );
  void label;
  return Promise.race([promise, timeout]);
}

function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function completeAssistantChat(params: {
  systemPrompt: string;
  messages: ChatMessage[];
}): Promise<string> {
  const config = getAssistantConfig();

  if (!config.enabled || !config.apiKey) {
    throw new AppError('Assistenten er ikke aktivert på serveren.', 503);
  }

  const completionParams = {
    systemPrompt: params.systemPrompt,
    messages: params.messages,
    apiKey: config.apiKey,
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
  };

  if (config.provider === 'gemini') {
    try {
      return await withTimeout(completeWithGemini(completionParams), config.timeoutMs, 'gemini');
    } catch (primaryErr) {
      const fallbackKey = process.env.OPENAI_API_KEY?.trim();
      if (!fallbackKey) throw primaryErr;
      logger.warn(
        { provider: 'gemini', err: getErrorMessage(primaryErr) },
        'Primary assistant provider failed, trying OpenAI fallback',
      );
      const fallbackModel = process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini';
      const reply = await withTimeout(
        completeWithOpenAi({ ...completionParams, apiKey: fallbackKey, model: fallbackModel }),
        config.timeoutMs,
        'openai-fallback',
      );
      logger.info({ provider: 'openai', fallbackFor: 'gemini' }, 'Assistant fallback succeeded');
      return reply;
    }
  }

  return withTimeout(completeWithOpenAi(completionParams), config.timeoutMs, 'openai');
}
