import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageCircle, Square, X, Trash2 } from 'lucide-react';
import { assistantApi } from '../../lib/api/assistant';
import { queryKeys } from '../../lib/queryKeys';
import { useAssistantChat } from '../../hooks/useAssistantChat';
import { AssistantMessageList } from './AssistantMessageList';
import { AssistantInput } from './AssistantInput';

interface AssistantChatProps {
  /** Lift FAB above mobile bottom nav (kunde). */
  elevatedBottom?: boolean;
}

export function AssistantChat({ elevatedBottom = false }: AssistantChatProps) {
  const fabBottom = elevatedBottom ? 'bottom-20' : 'bottom-6';
  const panelBottom = elevatedBottom ? 'bottom-36' : 'bottom-24';
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: queryKeys.assistant.status,
    queryFn: async () => {
      const res = await assistantApi.getStatus();
      return res.data;
    },
    staleTime: 60_000,
  });

  const { messages, isLoading, error, send, retry, abort, clear, suggestedQuestions } = useAssistantChat();

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [open, messages, isLoading]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isLoading) abort();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, isLoading, abort]);

  if (!statusLoading && !status?.enabled) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={statusLoading}
        className={`fixed ${fabBottom} right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-500 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-400 focus:ring-offset-2 focus:ring-offset-dark-950 disabled:opacity-60`}
        aria-expanded={open}
        aria-controls="assistant-panel"
        aria-label={open ? 'Lukk TESS-assistent' : 'Åpne TESS-assistent'}
      >
        {open ? <X className="h-6 w-6" aria-hidden /> : <MessageCircle className="h-6 w-6" aria-hidden />}
      </button>

      <AnimatePresence>
        {open && status?.enabled !== false && (
          <motion.div
            id="assistant-panel"
            role="dialog"
            aria-labelledby="assistant-title"
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className={`fixed ${panelBottom} right-6 z-40 flex w-[min(100vw-2rem,24rem)] flex-col overflow-hidden rounded-2xl border border-dark-700 bg-dark-950/95 shadow-2xl backdrop-blur-md`}
          >
            <header className="flex items-center justify-between gap-2 border-b border-dark-700/80 px-4 py-3 bg-dark-900/90">
              <div>
                <h2 id="assistant-title" className="text-sm font-semibold text-white">
                  TESS-assistent
                </h2>
                <p className="text-xs text-dark-500">Kun hjelp om systemet</p>
              </div>
              <div className="flex items-center gap-1">
                {isLoading && (
                  <button
                    type="button"
                    onClick={abort}
                    className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                    aria-label="Avbryt"
                    title="Avbryt"
                  >
                    <Square className="h-4 w-4" aria-hidden />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (messages.length === 0 || isLoading) return;
                    if (window.confirm('Tøm samtalen?')) clear();
                  }}
                  disabled={messages.length === 0 || isLoading}
                  className="p-2 rounded-lg text-dark-400 hover:text-dark-200 hover:bg-dark-800 disabled:opacity-40"
                  aria-label="Tøm samtale"
                  title="Tøm samtale"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 max-h-72 overflow-y-auto p-4 space-y-3">
              <AssistantMessageList messages={messages} isLoading={isLoading} />
              {error && (
                <div className="flex items-center justify-between gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="shrink-0 rounded-md px-2 py-1 font-medium text-red-300 hover:bg-red-500/20 hover:text-red-200 transition-colors"
                  >
                    Prøv igjen
                  </button>
                </div>
              )}
              {messages.length === 0 && !isLoading && (
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => send(q)}
                      className="text-xs rounded-full px-3 py-1.5 bg-dark-800 border border-dark-600 text-dark-300 hover:border-primary-500/40 hover:text-primary-300 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <AssistantInput onSend={send} disabled={isLoading} autoFocus={open} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
