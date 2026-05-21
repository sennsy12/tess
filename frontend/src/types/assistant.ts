export type AssistantMessageRole = 'user' | 'assistant';

export interface AssistantMessage {
  id: string;
  role: AssistantMessageRole;
  content: string;
}

export interface AssistantChatResponse {
  reply: string;
  sources: string[];
}

export interface AssistantStatusResponse {
  enabled: boolean;
}
