import { AppError } from '../../middleware/errorHandler.js';
import { getAssistantConfig } from '../config.js';
import type { ChatMessage } from '../types.js';
import { completeWithGemini } from './gemini.js';
import { completeWithOpenAi } from './openai.js';

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
    return completeWithGemini(completionParams);
  }

  return completeWithOpenAi(completionParams);
}
