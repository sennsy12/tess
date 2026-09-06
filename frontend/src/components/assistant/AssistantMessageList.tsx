import { useState } from 'react';
import type { ReactNode } from 'react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { AssistantMessage } from '../../types/assistant';

interface AssistantMessageListProps {
  messages: AssistantMessage[];
  isLoading: boolean;
}

const FEEDBACK_STORAGE_KEY = 'tess-assistant-feedback';

type FeedbackValue = 'up' | 'down';

function loadFeedback(): Record<string, FeedbackValue> {
  try {
    const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out: Record<string, FeedbackValue> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (v === 'up' || v === 'down') out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Split off a trailing "Kilder: a, b" line (backend prompt contract) before markdown. */
function splitKilder(content: string): { body: string; sources: string[] } {
  const lines = content.split('\n');
  const kilderRe = /^\s*Kilder\s*:\s*(.*)\s*$/i;
  let sources: string[] = [];
  let stripped = false;
  const bodyLines: string[] = [];
  for (const line of lines) {
    const m = kilderRe.exec(line);
    if (m && !stripped) {
      stripped = true;
      const raw = (m[1] ?? '').trim();
      if (raw) {
        sources = raw
          .split(/[,;]/)
          .map((s) => s.trim())
          .filter(Boolean);
      }
      continue;
    }
    bodyLines.push(line);
  }
  let body = bodyLines.join('\n');
  if (stripped) body = body.trimEnd();
  return { body, sources };
}

/** **bold** via **-pair split -> <strong>. Unclosed trailing ** stays as plain text. */
function renderBold(segment: string, keyPrefix: string): ReactNode[] {
  if (!segment.includes('**')) return [segment];
  const parts = segment.split('**');
  const out: ReactNode[] = [];
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i] ?? '';
    if (i % 2 === 1) {
      if (i === parts.length - 1) {
        // Unclosed ** — keep literal.
        out.push(`**${part}`);
      } else if (part) {
        out.push(
          <strong key={`${keyPrefix}-b${i}`} className="font-semibold">
            {part}
          </strong>,
        );
      }
    } else if (part) {
      out.push(part);
    }
  }
  return out;
}

/** [text](/path) internal links only (href must start with /) — else plain text. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const linkRe = /\[([^\]]+)\]\(([^)]+)\)/g;
  const out: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let n = 0;
  while ((match = linkRe.exec(text)) !== null) {
    const idx = match.index;
    if (idx > last) {
      const plain = text.slice(last, idx);
      out.push(...renderBold(plain, `${keyPrefix}-t${n}`));
    }
    const label = match[1] ?? '';
    const href = (match[2] ?? '').trim();
    if (href.startsWith('/')) {
      out.push(
        <a
          key={`${keyPrefix}-a${n}`}
          href={href}
          className="underline decoration-primary-400/60 underline-offset-2 hover:text-primary-200"
        >
          {renderBold(label, `${keyPrefix}-a${n}l`)}
        </a>,
      );
    } else {
      // External or unsafe href — render as plain text, no link.
      out.push(match[0]);
    }
    last = idx + match[0].length;
    n += 1;
  }
  if (last < text.length) {
    out.push(...renderBold(text.slice(last), `${keyPrefix}-t${n}`));
  }
  if (out.length === 0) return [text];
  return out.map((node, i) =>
    typeof node === 'string' ? (
      <span key={`${keyPrefix}-s${i}`}>{node}</span>
    ) : (
      <span key={`${keyPrefix}-w${i}`}>{node}</span>
    ),
  );
}

/** `code` via backtick split -> <code>. Unclosed trailing backtick stays literal. */
function renderInlineWithCode(text: string, keyPrefix: string): ReactNode {
  if (!text.includes('`')) return <>{renderInline(text, keyPrefix)}</>;
  const parts = text.split('`');
  const unclosed = parts.length % 2 === 0;
  return (
    <>
      {parts.map((part, i) => {
        const isCode = i % 2 === 1 && !(unclosed && i === parts.length - 1);
        if (isCode) {
          return (
            <code
              key={`${keyPrefix}-c${i}`}
              className="rounded bg-dark-900 px-1 py-0.5 font-mono text-[12px] text-primary-200"
            >
              {part}
            </code>
          );
        }
        const literal = unclosed && i === parts.length - 1 ? `\`${part}` : part;
        return <span key={`${keyPrefix}-p${i}`}>{renderInline(literal, `${keyPrefix}-p${i}`)}</span>;
      })}
    </>
  );
}

function renderMarkdownLight(body: string, keyPrefix: string): ReactNode {
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockIdx = 0;
  const bulletRe = /^\s*[-*]\s+(.+)$/;
  const numberedRe = /^\s*\d+\.\s+(.+)$/;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    const bullet = bulletRe.exec(line);
    const numbered = numberedRe.exec(line);

    if (bullet) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const m = bulletRe.exec(lines[j] ?? '');
        if (!m) break;
        items.push(m[1] ?? '');
        j += 1;
      }
      blocks.push(
        <ul key={`${keyPrefix}-ul${blockIdx}`} className="list-disc space-y-0.5 pl-5">
          {items.map((item, k) => (
            <li key={`${keyPrefix}-ul${blockIdx}-li${k}`}>
              {renderInlineWithCode(item, `${keyPrefix}-ul${blockIdx}-li${k}`)}
            </li>
          ))}
        </ul>,
      );
      i = j;
      blockIdx += 1;
      continue;
    }

    if (numbered) {
      const items: string[] = [];
      let j = i;
      while (j < lines.length) {
        const m = numberedRe.exec(lines[j] ?? '');
        if (!m) break;
        items.push(m[1] ?? '');
        j += 1;
      }
      blocks.push(
        <ol key={`${keyPrefix}-ol${blockIdx}`} className="list-decimal space-y-0.5 pl-5">
          {items.map((item, k) => (
            <li key={`${keyPrefix}-ol${blockIdx}-li${k}`}>
              {renderInlineWithCode(item, `${keyPrefix}-ol${blockIdx}-li${k}`)}
            </li>
          ))}
        </ol>,
      );
      i = j;
      blockIdx += 1;
      continue;
    }

    if (line.trim() === '') {
      // Preserve paragraph breaks between block elements.
      if (blocks.length > 0 && i < lines.length - 1) {
        blocks.push(<div key={`${keyPrefix}-sp${blockIdx}`} className="h-1.5" aria-hidden />);
        blockIdx += 1;
      }
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`${keyPrefix}-p${blockIdx}`} className="m-0">
        {renderInlineWithCode(line, `${keyPrefix}-p${blockIdx}`)}
      </p>,
    );
    blockIdx += 1;
    i += 1;
  }

  return <div className="space-y-1">{blocks}</div>;
}

export function AssistantMessageList({ messages, isLoading }: AssistantMessageListProps) {
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>(loadFeedback);

  const toggleFeedback = (id: string, value: FeedbackValue) => {
    setFeedback((prev) => {
      const next = { ...prev };
      if (next[id] === value) {
        delete next[id];
      } else {
        next[id] = value;
      }
      try {
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Quota / private mode — feedback still works in-memory.
      }
      return next;
    });
  };

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
      {messages.map((msg) => {
        const isUser = msg.role === 'user';
        if (isUser) {
          return (
            <li key={msg.id} className="flex justify-end">
              <div className="max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-primary-600/90 text-white rounded-br-sm">
                {msg.content}
              </div>
            </li>
          );
        }

        const { body, sources } = splitKilder(msg.content);
        const current = feedback[msg.id];

        return (
          <li key={msg.id} className="flex justify-start">
            <div className="max-w-[90%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap bg-dark-800 text-dark-100 border border-dark-700 rounded-bl-sm">
              {renderMarkdownLight(body, msg.id)}
              {sources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Kilder">
                  {sources.map((s, idx) => (
                    <span
                      key={`${s}-${idx}`}
                      className="rounded-full border border-dark-600 bg-dark-900 px-2 py-0.5 text-[11px] text-dark-300"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleFeedback(msg.id, 'up')}
                  aria-label="Nyttig"
                  aria-pressed={current === 'up'}
                  title="Nyttig"
                  className={`rounded-md border p-1.5 transition-colors ${
                    current === 'up'
                      ? 'border-primary-500/40 bg-primary-600/20 text-primary-300'
                      : 'border-transparent text-dark-500 hover:text-dark-200 hover:bg-dark-700/60'
                  }`}
                >
                  <ThumbsUp className="h-3.5 w-3.5" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => toggleFeedback(msg.id, 'down')}
                  aria-label="Ikke nyttig"
                  aria-pressed={current === 'down'}
                  title="Ikke nyttig"
                  className={`rounded-md border p-1.5 transition-colors ${
                    current === 'down'
                      ? 'border-primary-500/40 bg-primary-600/20 text-primary-300'
                      : 'border-transparent text-dark-500 hover:text-dark-200 hover:bg-dark-700/60'
                  }`}
                >
                  <ThumbsDown className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            </div>
          </li>
        );
      })}
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
