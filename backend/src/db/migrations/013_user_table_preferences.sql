-- 013_user_table_preferences.sql
-- Per-bruker tabellpreferanser: synlige kolonner + egne visningsnavn.
--
-- Hvorfor egen tabell i stedet for saved_reports:
-- - saved_reports er navngitte, delbare snapshots (arbeidsflater) med
--   fri config-struktur; preferanser er implisitt grunntilstand per
--   (bruker, tabell) som alltid finnes (én rad) og aldri deles.
-- - getByUser skanner alle rader; her er oppslag O(1) på primærnøkkel.
--
-- Validering av kolonnenøkler/labels skjer i API-laget (zod) + klientens
-- sanitize – ikke mot et levende kolonneregister her, siden kolonner
-- endres med frontend-versjoner. Ukjente nøkler ignoreres ved lesing.

CREATE TABLE IF NOT EXISTS public.user_table_preferences (
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  table_key TEXT NOT NULL CHECK (char_length(table_key) BETWEEN 1 AND 64),
  visible_columns JSONB,
  column_labels JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, table_key)
);

CREATE INDEX IF NOT EXISTS idx_user_table_preferences_user
  ON public.user_table_preferences (user_id);
