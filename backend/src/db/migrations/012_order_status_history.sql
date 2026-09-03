-- 012_order_status_history.sql
-- Dedykowana historia zmian statusu workflow zamówienia.
--
-- Dlaczego osobna tabela zamiast samego audit_log:
-- - audit_log jest best-effort (auditService nigdy nie rzuca) i nie ma pola
--   na komentarz/decyzję admina (np. powód odrzucenia);
-- - timeline potrzebuje szybkiego `WHERE ordrenr = $1 ORDER BY created_at`
--   bez skanowania generycznego logu audytu;
-- - updateStatus nie przekazywał `req`, więc większość zmian statusu w ogóle
--   nie trafiała do audit_log (naprawione razem z tą migracją po stronie kodu).
--
-- Backfill jest best-effort: przepisuje to, co da się wyciągnąć z audit_log
-- (entity_type = 'ordre'), reszta historii zaczyna się od zera.

CREATE TABLE IF NOT EXISTS public.ordre_status_history (
  id BIGSERIAL PRIMARY KEY,
  ordrenr INTEGER NOT NULL REFERENCES public.ordre(ordrenr) ON DELETE CASCADE,
  previous_status TEXT
    CHECK (previous_status IS NULL OR previous_status IN
      ('new', 'pending_approval', 'approved', 'rejected', 'processing', 'shipped', 'invoiced', 'cancelled')),
  new_status TEXT NOT NULL
    CHECK (new_status IN
      ('new', 'pending_approval', 'approved', 'rejected', 'processing', 'shipped', 'invoiced', 'cancelled')),
  changed_by_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  changed_by_username TEXT NOT NULL DEFAULT 'system',
  changed_by_role TEXT NOT NULL DEFAULT 'admin'
    CHECK (changed_by_role IN ('admin', 'kunde', 'analyse', 'system')),
  comment TEXT CHECK (comment IS NULL OR char_length(comment) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ordre_status_history_ordrenr
  ON public.ordre_status_history (ordrenr, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ordre_status_history_created_at
  ON public.ordre_status_history (created_at DESC);

-- Backfill z audit_log (tylko UPDATE ze zmianą workflow_status + CREATE jako wpis początkowy).
-- Idempotentny dzięki NOT EXISTS na (ordrenr, new_status, created_at).
INSERT INTO public.ordre_status_history
  (ordrenr, previous_status, new_status, changed_by_username, changed_by_role, comment, created_at)
SELECT
  a.entity_id::INTEGER AS ordrenr,
  NULLIF(a.changes->'workflow_status'->>'old', '') AS previous_status,
  COALESCE(NULLIF(a.changes->'workflow_status'->>'new', ''), 'new') AS new_status,
  COALESCE(NULLIF(a.username, ''), 'system') AS changed_by_username,
  'admin' AS changed_by_role,
  NULLIF(TRIM(COALESCE(a.entity_name, '')), '') AS comment,
  a.timestamp AS created_at
FROM public.audit_log a
WHERE a.entity_type = 'ordre'
  AND a.action = 'UPDATE'
  AND a.entity_id ~ '^\d+$'
  AND a.changes IS NOT NULL
  AND (a.changes ? 'workflow_status')
  AND NOT EXISTS (
    SELECT 1 FROM public.ordre_status_history h
    WHERE h.ordrenr = a.entity_id::INTEGER
      AND h.new_status = COALESCE(NULLIF(a.changes->'workflow_status'->>'new', ''), 'new')
      AND h.created_at = a.timestamp
  );
