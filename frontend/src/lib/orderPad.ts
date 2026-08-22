export interface ParsedPadLine {
  varekode: string;
  antall: number;
  sourceLine: number;
}

export interface PadParseIssue {
  sourceLine: number;
  raw: string;
  reason: string;
}

export interface OrderPadParseResult {
  lines: ParsedPadLine[];
  issues: PadParseIssue[];
}

export const ORDER_PAD_MAX_LINES = 100;
export const ORDER_PAD_DEFAULT_QTY = 1;
export const ORDER_PAD_MAX_QTY = 1_000_000;

const LINE_SEPARATOR = /\r?\n/;
const TOKEN_SEPARATOR = /[\t;,]+|\s+/;
const OVERFLOW_REASON = 'Maks antall linjer overskredet';

function toTokens(raw: string): string[] {
  return raw.split(TOKEN_SEPARATOR).filter((token) => token.length > 0);
}

/**
 * Parses pasted quick-order text where each line is `<varekode>[ <antall>]`.
 * Separators may be whitespace, tab, semicolon or comma. Lines starting with
 * '#' are treated as comments. Duplicate varekode entries are summed.
 */
export function parseOrderPadInput(input: string): OrderPadParseResult {
  const lines: ParsedPadLine[] = [];
  const issues: PadParseIssue[] = [];
  const lineByCode = new Map<string, ParsedPadLine>();

  input.split(LINE_SEPARATOR).forEach((rawLine, index) => {
    const raw = rawLine.trim();
    if (!raw || raw.startsWith('#')) return;

    const sourceLine = index + 1;
    const tokens = toTokens(raw);

    if (tokens.length === 0 || tokens.length > 2) {
      issues.push({ sourceLine, raw, reason: 'Kunne ikke tolke linjen' });
      return;
    }

    const varekode = tokens[0];
    let antall = ORDER_PAD_DEFAULT_QTY;

    if (tokens.length === 2) {
      const parsedQty = Number(tokens[1]);
      if (!Number.isInteger(parsedQty) || parsedQty < 1) {
        issues.push({ sourceLine, raw, reason: 'Ugyldig antall' });
        return;
      }
      antall = Math.min(parsedQty, ORDER_PAD_MAX_QTY);
    }

    const key = varekode.toUpperCase();
    const existing = lineByCode.get(key);
    if (existing) {
      existing.antall = Math.min(existing.antall + antall, ORDER_PAD_MAX_QTY);
      return;
    }

    if (lines.length >= ORDER_PAD_MAX_LINES) {
      if (!issues.some((issue) => issue.reason === OVERFLOW_REASON)) {
        issues.push({ sourceLine, raw, reason: OVERFLOW_REASON });
      }
      return;
    }

    const entry: ParsedPadLine = { varekode, antall, sourceLine };
    lineByCode.set(key, entry);
    lines.push(entry);
  });

  return { lines, issues };
}
