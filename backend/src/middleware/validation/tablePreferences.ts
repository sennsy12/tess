import { z } from 'zod';

/** Maks lengde på egne visningsnavn – speiles i frontend (MAX_COLUMN_LABEL_LENGTH). */
export const MAX_COLUMN_LABEL_LENGTH = 40;
/** Maks antall kolonner med egendefinert navn per tabell. */
const MAX_LABEL_ENTRIES = 20;
/** Maks antall synlige kolonner som lagres (beskytter mot gigantiske payloads). */
const MAX_VISIBLE_COLUMNS = 50;

/** URL-param :tableKey – samme grenser som CHECK i migrasjon 013. */
export const tableKeyParamSchema = z.object({
  tableKey: z.string().min(1).max(64),
});

/**
 * PUT-body. Begge felt valgfrie, men minst ett må være satt.
 * - visibleColumns: null/utelatt = «behold eksisterende» (første gang:
 *   codedefaults). Tom array avvises (en tabell uten kolonner er aldri et
 *   gyldig ønske – klienten faller tilbake til defaults via sanitize).
 * - columnLabels: utelatt = «behold eksisterende». Tom streng-verdi betyr
 *   «slett overstyring for nøkkelen» og normaliseres bort her, slik at DB
 *   aldri lagrer tomme labels.
 */
const columnLabelsSchema = z
  .record(z.string().min(1).max(64), z.string().max(200))
  .refine((labels) => Object.keys(labels).length <= MAX_LABEL_ENTRIES, {
    message: `Too many custom labels (max ${MAX_LABEL_ENTRIES})`,
  })
  .nullish()
  .transform((labels) => {
    if (labels == null) return undefined;
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(labels)) {
      const trimmed = value.trim().slice(0, MAX_COLUMN_LABEL_LENGTH);
      // Tom streng etter trim = «tilbakestill til default» → lagres ikke.
      if (trimmed) normalized[key.trim()] = trimmed;
    }
    return normalized;
  });

export const tablePreferencesBodySchema = z
  .object({
    visibleColumns: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(MAX_VISIBLE_COLUMNS)
      .nullish(),
    columnLabels: columnLabelsSchema,
  })
  .refine((body) => body.visibleColumns != null || body.columnLabels !== undefined, {
    message: 'At least one of visibleColumns or columnLabels is required',
  });

export type TablePreferencesBody = z.infer<typeof tablePreferencesBodySchema>;
