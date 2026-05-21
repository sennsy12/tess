export type UserRole = 'admin' | 'kunde' | 'analyse';

export interface KnowledgeChunk {
  id: string;
  title: string;
  content: string;
  /** Roles that may receive this chunk; omit = all roles */
  roles?: UserRole[];
  keywords: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatRequest {
  messages: ChatMessage[];
  pathname?: string;
}

export interface AssistantChatResponse {
  reply: string;
  sources: string[];
}

export interface AssistantStatusResponse {
  enabled: boolean;
}
