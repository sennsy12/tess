import type { ChatMessage } from '../types.js';

export interface CompletionParams {
  systemPrompt: string;
  messages: ChatMessage[];
  apiKey: string;
  model: string;
  maxOutputTokens: number;
}

export type AssistantProvider = 'gemini' | 'openai';
