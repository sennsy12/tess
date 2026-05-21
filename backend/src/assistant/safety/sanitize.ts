import { ValidationError } from '../../middleware/errorHandler.js';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_MESSAGES = 12;

/** Patterns that must never be sent to the model or logged in full. */
const BLOCKED_PATTERNS: RegExp[] = [
  /\b(skriv|vis|hent|dump).{0,30}(passord|password|api[_-]?key|jwt|token|hemmelighet)/i,
  /\b(ignore|forget|disregard).{0,20}(previous|prior|system).{0,20}(instructions?|prompt)/i,
  /\b(jailbreak|dan\s*mode|do\s+anything\s+now)\b/i,
  /\b(bearer\s+[a-z0-9._-]{20,})/i,
  /\b(ADMIN_ACTION_KEY|JWT_SECRET|OPENAI_API_KEY|GEMINI_API_KEY)\b/,
  /\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b.+\b(FROM|INTO|TABLE)\b/i,
];

const EMAIL_LIKE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;

export function sanitizeUserText(raw: string): string {
  let text = raw.normalize('NFKC').trim();
  text = text.replace(/<[^>]*>/g, '');
  if (text.length > MAX_MESSAGE_LENGTH) {
    throw new ValidationError(`Meldingen er for lang (maks ${MAX_MESSAGE_LENGTH} tegn).`);
  }
  if (text.length === 0) {
    throw new ValidationError('Meldingen kan ikke være tom.');
  }
  return text;
}

export function assertSafeUserMessage(content: string): void {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      throw new ValidationError(
        'Meldingen inneholder ikke tillatt innhold. Spør om hvordan TESS fungerer, ikke om hemmeligheter eller datauttrekk.'
      );
    }
  }
  if (EMAIL_LIKE.test(content) && content.length > 80) {
    throw new ValidationError('Ikke lim inn e-post eller store tekstblokker med persondata.');
  }
}

export function sanitizeMessageHistory(
  messages: { role: string; content: string }[]
): { role: 'user' | 'assistant'; content: string }[] {
  if (messages.length > MAX_MESSAGES) {
    throw new ValidationError(`For mange meldinger (maks ${MAX_MESSAGES}).`);
  }

  const normalized: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant') {
      throw new ValidationError('Ugyldig meldingsrolle.');
    }
    const content = sanitizeUserText(msg.content);
    if (msg.role === 'user') {
      assertSafeUserMessage(content);
    }
    normalized.push({ role: msg.role, content });
  }

  const last = normalized[normalized.length - 1];
  if (!last || last.role !== 'user') {
    throw new ValidationError('Siste melding må være fra brukeren.');
  }

  return normalized;
}
