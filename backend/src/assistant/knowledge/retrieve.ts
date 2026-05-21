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

/**
 * Keyword retrieval over curated chunks (no external vector DB).
 */
export function retrieveKnowledge(query: string, role: UserRole): KnowledgeChunk[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return KNOWLEDGE_CHUNKS.filter((c) => chunkVisibleForRole(c, role)).slice(0, 4);
  }

  return KNOWLEDGE_CHUNKS.filter((c) => chunkVisibleForRole(c, role))
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
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
