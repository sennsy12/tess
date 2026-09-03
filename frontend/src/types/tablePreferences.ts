/** Maks lengde på egne visningsnavn – speiler backend (MAX_COLUMN_LABEL_LENGTH). */
export const MAX_COLUMN_LABEL_LENGTH = 40;

/** Serverens svarform for én (bruker, tabell)-preferanse. */
export interface TablePreferences {
  tableKey: string;
  /** null = ingen preferanse lagret → bruk codedefaults. */
  visibleColumns: string[] | null;
  columnLabels: Record<string, string>;
  updatedAt: string | null;
}

/**
 * Normaliser et labels-objekt fra server/lokal lagring: trim, dropp tomme,
 * cap lengde og antall. Samme regler begge veier – DB lagrer aldri søppel,
 * klienten stoler aldri blindt på det som leses.
 */
export function sanitizeColumnLabels(
  raw: unknown,
  knownKeys?: readonly string[],
): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue;
    if (knownKeys && !knownKeys.includes(key)) continue;
    const trimmed = value.trim().slice(0, MAX_COLUMN_LABEL_LENGTH);
    if (trimmed) out[key] = trimmed;
    if (Object.keys(out).length >= 20) break;
  }
  return out;
}

/** Visningsnavn for én kolonne: overstyring vinner, ellers default header. */
export function resolveColumnHeader(
  columnKey: string,
  defaultHeader: string,
  labels: Record<string, string> | undefined,
): string {
  const custom = labels?.[columnKey]?.trim();
  return custom ? custom : defaultHeader;
}
