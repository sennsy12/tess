import api from './client';
import type { AssistantChatResponse, AssistantMessage, AssistantStatusResponse } from '../../types/assistant';

export const assistantApi = {
  getStatus: () => api.get<AssistantStatusResponse>('/assistant/status'),

  sendMessage: (payload: {
    messages: Pick<AssistantMessage, 'role' | 'content'>[];
    pathname?: string;
  }) => api.post<AssistantChatResponse>('/assistant/chat', payload),
};
