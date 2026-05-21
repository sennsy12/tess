import { useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { assistantApi } from '../lib/api/assistant';
import type { AssistantMessage } from '../types/assistant';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const SUGGESTED_QUESTIONS = [
  'Hvor finner jeg ordrene mine?',
  'Hva kan jeg gjøre som min rolle?',
  'Hvordan fungerer statistikk?',
] as const;

export function useAssistantChat() {
  const { pathname } = useLocation();
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;

      setError(null);
      const userMessage: AssistantMessage = {
        id: newId(),
        role: 'user',
        content: trimmed,
      };

      const nextMessages = [...messages, userMessage];
      setMessages(nextMessages);
      setIsLoading(true);

      try {
        const { data } = await assistantApi.sendMessage({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          pathname,
        });

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: data.reply,
          },
        ]);
      } catch (err: unknown) {
        const apiError =
          err &&
          typeof err === 'object' &&
          'response' in err &&
          err.response &&
          typeof err.response === 'object' &&
          'data' in err.response &&
          err.response.data &&
          typeof err.response.data === 'object' &&
          'error' in err.response.data &&
          typeof (err.response.data as { error: unknown }).error === 'string'
            ? (err.response.data as { error: string }).error
            : null;

        setError(apiError ?? 'Kunne ikke sende melding. Prøv igjen.');
        setMessages(nextMessages);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, pathname]
  );

  const clear = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    send,
    clear,
    suggestedQuestions: SUGGESTED_QUESTIONS,
  };
}
