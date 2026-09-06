import { logger } from '../lib/logger.js';
import { getAssistantConfig } from './config.js';
import { retrieveKnowledge, formatKnowledgeContext } from './knowledge/retrieve.js';
import { buildSystemPrompt } from './safety/prompt.js';
import { sanitizeMessageHistory } from './safety/sanitize.js';
import { completeAssistantChat } from './providers/index.js';
import type { AssistantChatRequest, AssistantChatResponse, UserRole } from './types.js';

export async function runAssistantChat(params: {
  userId: number;
  role: UserRole;
  body: AssistantChatRequest;
}): Promise<AssistantChatResponse> {
  const messages = sanitizeMessageHistory(params.body.messages);
  const lastUser = messages[messages.length - 1]!;

  const chunks = retrieveKnowledge(lastUser.content, params.role, params.body.pathname);
  const knowledgeContext = formatKnowledgeContext(chunks);
  const systemPrompt = buildSystemPrompt({
    role: params.role,
    pathname: params.body.pathname,
    knowledgeContext,
  });

  const { provider } = getAssistantConfig();

  const reply = await completeAssistantChat({
    systemPrompt,
    messages,
  });

  logger.info(
    {
      userId: params.userId,
      role: params.role,
      provider,
      pathname: params.body.pathname,
      chunkIds: chunks.map((c) => c.id),
      messageCount: messages.length,
    },
    'Assistant chat completed'
  );

  return {
    reply,
    sources: chunks.map((c) => c.title),
  };
}
