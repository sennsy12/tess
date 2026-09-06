import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { assistantApi } from '../lib/api/assistant';
import { getApiError } from '../lib/apiErrors';
import { AuthContext } from '../context/authContextInstance';
import type { AssistantMessage } from '../types/assistant';
import type { UserRole } from '../types/user';

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const DEFAULT_QUESTIONS = [
  'Hvor finner jeg ordrene mine?',
  'Hva kan jeg gjøre som min rolle?',
  'Hvordan fungerer statistikk?',
] as const;

const KUNDE_QUESTIONS = [
  'Hvor finner jeg ordrene mine?',
  'Hvor ser jeg prisene mine?',
  'Hvordan fungerer statistikk?',
] as const;

const ADMIN_QUESTIONS = [
  'Hvordan lager jeg en prisregel?',
  'Hvordan importerer jeg data?',
  'Hvor finner jeg endringsloggen?',
] as const;

const ANALYSE_QUESTIONS = [
  'Hvordan fungerer statistikk?',
  'Hva viser avansert analyse?',
  'Hvordan filtrerer jeg på dato?',
] as const;

const PRICING_ADMIN_QUESTIONS = [
  'Hvordan lager jeg en prisregel?',
  'Hvordan fungerer prisberegning?',
  'Hvor ser jeg kundenes priser?',
] as const;

const ETL_QUESTIONS = [
  'Hvordan importerer jeg data?',
  'Hvordan sjekker jeg ETL-status?',
  'Hva gjør jeg hvis importen feiler?',
] as const;

const ORDERS_QUESTIONS = [
  'Hvor finner jeg ordrene mine?',
  'Hvordan oppretter jeg en ny ordre?',
  'Hvordan sjekker jeg status på en ordre?',
] as const;

const PRICING_KUNDE_QUESTIONS = [
  'Hvor ser jeg prisene mine?',
  'Hvordan fungerer rabatter?',
  'Hvem kontakter jeg om priser?',
] as const;

const STATS_QUESTIONS = [
  'Hvordan fungerer statistikk?',
  'Hva viser avansert analyse?',
  'Hvordan filtrerer jeg på dato?',
] as const;

/** P1-C: pure role + path -> suggested questions. Path overrides take precedence. */
export function getSuggestedQuestions(
  role: UserRole | undefined,
  pathname: string
): readonly string[] {
  if (pathname.startsWith('/admin/pricing')) return PRICING_ADMIN_QUESTIONS;
  if (pathname.startsWith('/admin/etl')) return ETL_QUESTIONS;
  if (pathname.startsWith('/kunde/orders')) return ORDERS_QUESTIONS;
  if (pathname.startsWith('/kunde/pricing')) return PRICING_KUNDE_QUESTIONS;
  if (
    pathname === '/analyse' ||
    pathname.startsWith('/analyse/') ||
    pathname.includes('statistics') ||
    pathname.includes('analytics')
  )
    return STATS_QUESTIONS;
  if (role === 'kunde') return KUNDE_QUESTIONS;
  if (role === 'admin') return ADMIN_QUESTIONS;
  if (role === 'analyse') return ANALYSE_QUESTIONS;
  return DEFAULT_QUESTIONS;
}

const STORAGE_KEY_PREFIX = 'tess-assistant-messages';
const MAX_STORED_MESSAGES = 12;
const SEND_ERROR_FALLBACK = 'Kunne ikke sende melding. Prøv igjen.';

function storageKey(userId: number | undefined): string {
  return userId !== undefined ? `${STORAGE_KEY_PREFIX}:${userId}` : STORAGE_KEY_PREFIX;
}

/** axios abort: CanceledError with code 'ERR_CANCELED'. Silent — no error toast. */
function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const record = err as { code?: unknown; name?: unknown };
  return record.code === 'ERR_CANCELED' || record.name === 'CanceledError';
}

function isValidStoredMessage(item: unknown): item is { id?: unknown; role: 'user' | 'assistant'; content: string } {
  if (!item || typeof item !== 'object') return false;
  const record = item as Record<string, unknown>;
  return (
    (record.role === 'user' || record.role === 'assistant') &&
    typeof record.content === 'string' &&
    record.content.length >= 1 &&
    record.content.length <= 2000
  );
}

function loadStoredMessages(key: string): AssistantMessage[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: AssistantMessage[] = [];
    for (const item of parsed) {
      if (!isValidStoredMessage(item)) continue;
      valid.push({
        id: typeof item.id === 'string' && item.id ? item.id : newId(),
        role: item.role,
        content: item.content,
      });
    }
    return valid.slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export function useAssistantChat() {
  const { pathname } = useLocation();
  // Optional context access (no throw outside AuthProvider): per-user storage key.
  const auth = useContext(AuthContext);
  const userId = auth?.user?.id;
  const userRole = auth?.user?.role;
  const key = storageKey(userId);

  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  // Refs keep retry/abort stable while send keeps [isLoading, messages, pathname].
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const keyRef = useRef(key);
  keyRef.current = key;

  // Abort in-flight request on unmount.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  // Load persisted messages on mount / user switch.
  useEffect(() => {
    setMessages(loadStoredMessages(key));
  }, [key]);

  // Persist on change (cap 12, keep ids). Never persists error/isLoading.
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(messages.slice(-MAX_STORED_MESSAGES)));
    } catch {
      // Quota / private mode — chat still works in-memory.
    }
  }, [key, messages]);

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

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { data } = await assistantApi.sendMessage(
          {
            messages: nextMessages.map(({ role, content }) => ({ role, content })),
            pathname,
          },
          controller.signal
        );

        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: 'assistant',
            content: data.reply,
          },
        ]);
      } catch (err: unknown) {
        if (isAbortError(err)) return;
        setError(getApiError(err, SEND_ERROR_FALLBACK));
        // No setMessages here: the optimistic user message is already in
        // state, so retry() can resend it. Re-setting would resurrect
        // messages after a mid-flight clear().
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setIsLoading(false);
      }
    },
    [isLoading, messages, pathname]
  );

  const retry = useCallback(async () => {
    if (isLoadingRef.current) return;
    const current = messagesRef.current;
    let hasUserMessage = false;
    for (let i = current.length - 1; i >= 0; i -= 1) {
      if (current[i]?.role === 'user') {
        hasUserMessage = true;
        break;
      }
    }
    if (!hasUserMessage) return;

    // Reuse existing messages as-is (failed send left the user message last)
    // — do NOT append a duplicate user message.
    setError(null);
    setIsLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const { data } = await assistantApi.sendMessage(
        {
          messages: current.map(({ role, content }) => ({ role, content })),
          pathname: pathnameRef.current,
        },
        controller.signal
      );

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: 'assistant',
          content: data.reply,
        },
      ]);
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      setError(getApiError(err, SEND_ERROR_FALLBACK));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsLoading(false);
    }
  }, []);

  const abort = useCallback(() => {
    const controller = abortRef.current;
    if (!controller) return;
    abortRef.current = null;
    controller.abort();
    // Silent: keep messages as-is, no error. finally-block also clears loading.
    setIsLoading(false);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    try {
      localStorage.removeItem(keyRef.current);
    } catch {
      // Ignore storage errors on clear.
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    send,
    retry,
    abort,
    clear,
    suggestedQuestions: getSuggestedQuestions(userRole, pathname),
  };
}
