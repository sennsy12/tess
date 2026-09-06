import { KNOWLEDGE_CHUNKS } from './chunks.js';
import type { KnowledgeChunk, UserRole } from '../types.js';

const MAX_CHUNKS = 8;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2);
}

function chunkVisibleForRole(chunk: KnowledgeChunk, role: UserRole): boolean {
  if (!chunk.roles || chunk.roles.length === 0) return true;
  return chunk.roles.includes(role);
}

function scoreChunk(chunk: KnowledgeChunk, queryTokens: string[]): number {
  const haystack = `${chunk.title} ${chunk.content} ${chunk.keywords.join(' ')}`.toLowerCase();
  let score = 0;
  for (const token of queryTokens) {
    if (chunk.keywords.some((k) => k.includes(token) || token.includes(k))) {
      score += 3;
    }
    if (haystack.includes(token)) {
      score += 1;
    }
  }
  return score;
}

const SYNONYMS: Record<string, string[]> = {
  order: ['ordre'],
  ordre: ['order'],
  pricing: ['pris'],
  pris: ['pricing'],
  user: ['bruker'],
  bruker: ['user'],
  statistics: ['statistikk', 'analytics'],
  analytics: ['statistikk', 'statistics'],
  statistikk: ['statistics', 'analytics'],
  import: ['etl', 'csv'],
  csv: ['etl', 'import'],
  etl: ['import', 'csv'],
};

function expandTokens(tokens: string[]): string[] {
  const out = new Set<string>(tokens);
  for (const token of tokens) {
    const syns = SYNONYMS[token];
    if (syns) {
      for (const s of syns) out.add(s);
    }
  }
  return [...out];
}

const PATH_BOOSTS: { prefix: string; terms: string[] }[] = [
  { prefix: '/admin/pricing', terms: ['pris', 'pricing', 'regel', 'simulator'] },
  { prefix: '/admin/etl', terms: ['etl', 'import', 'csv'] },
  { prefix: '/kunde/orders', terms: ['ordre', 'ordrenr'] },
  { prefix: '/kunde/pricing', terms: ['pris'] },
  { prefix: '/analyse', terms: ['statistikk', 'analyse'] },
  { prefix: '/statistics', terms: ['statistikk', 'analyse'] },
  { prefix: '/analytics', terms: ['statistikk', 'analyse'] },
  { prefix: '/admin/users', terms: ['bruker', 'audit'] },
  { prefix: '/admin/audit', terms: ['bruker', 'audit'] },
  { prefix: '/login', terms: ['login', 'innlogging'] },
];

function getPathBoostTerms(pathname?: string): string[] {
  if (!pathname) return [];
  const lower = pathname.toLowerCase();
  const terms: string[] = [];
  for (const { prefix, terms: t } of PATH_BOOSTS) {
    // Generic stats/analytics routes can be nested (e.g. /kunde/statistics,
    // /admin/analytics): match when the segment appears anywhere in the path.
    const isGenericStats =
      prefix === '/analyse' || prefix === '/statistics' || prefix === '/analytics';
    const matched = isGenericStats ? lower.includes(prefix) : lower.startsWith(prefix);
    if (matched) {
      terms.push(...t);
    }
  }
  return [...new Set(terms)];
}

/**
 * Keyword retrieval over curated chunks (no external vector DB).
 */
export function retrieveKnowledge(
  query: string,
  role: UserRole,
  pathname?: string
): KnowledgeChunk[] {
  const queryTokens = expandTokens(tokenize(query));
  if (queryTokens.length === 0) {
    return KNOWLEDGE_CHUNKS.filter((c) => chunkVisibleForRole(c, role)).slice(0, 4);
  }

  const boostTerms = getPathBoostTerms(pathname);

  return KNOWLEDGE_CHUNKS.filter((c) => chunkVisibleForRole(c, role))
    .map((chunk) => {
      let score = scoreChunk(chunk, queryTokens);
      if (boostTerms.length > 0 && scoreChunk(chunk, boostTerms) > 0) {
        score += 4;
      }
      return { chunk, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CHUNKS)
    .map(({ chunk }) => chunk);
}

export function formatKnowledgeContext(chunks: KnowledgeChunk[]): string {
  if (chunks.length === 0) {
    return '(Ingen treff i kunnskapsbasen — svar forsiktig og si at du er usikker.)';
  }
  return chunks
    .map((c) => `### ${c.title}\n${c.content}`)
    .join('\n\n');
}
