import type { AssistantMessage } from '../../types/assistant';

interface AssistantMessageListProps {
  messages: AssistantMessage[];
  isLoading: boolean;
}

export function AssistantMessageList({ messages, isLoading }: AssistantMessageListProps) {
  if (messages.length === 0 && !isLoading) {
    return (
      <p className="text-sm text-dark-400 px-1">
        Spør om navigasjon, roller eller hvordan TESS fungerer. Assistenten bruker kun offisiell
        produktkunnskap — ikke live ordredata.
      </p>
    );
  }

  return (
    <ul className="space-y-3" aria-live="polite">
      {messages.map((msg) => (
        <li
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-primary-600/90 text-white rounded-br-sm'
                : 'bg-dark-800 text-dark-100 border border-dark-700 rounded-bl-sm'
            }`}
          >
            {msg.content}
          </div>
        </li>
      ))}
      {isLoading && (
        <li className="flex justify-start">
          <div className="bg-dark-800 border border-dark-700 rounded-xl px-3 py-2 text-sm text-dark-400">
            Skriver…
          </div>
        </li>
      )}
    </ul>
  );
}
