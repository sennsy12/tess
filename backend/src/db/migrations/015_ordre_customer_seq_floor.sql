-- 015: reheal ordre_customer_seq floor (forward-only, non-destructive).
--
-- Customer-placed orders take ordrenr from nextval('ordre_customer_seq')
-- while bulk ETL imports historical orders with explicit high ordrenr
-- values. Migration 008 buffered the sequence only once, so a later ETL
-- import can overtake it and the next customer order fails duplicate-key.
--
-- This migration ONLY raises the sequence when it lags behind
-- MAX(ordre.ordrenr) and NEVER lowers it (GREATEST with current
-- last_value). No tables, data, or sequence values are destroyed or
-- rewritten. Safe to re-apply; skipped entirely before 008 has run.
DO $$
BEGIN
  IF to_regclass('public.ordre_customer_seq') IS NOT NULL THEN
    PERFORM setval(
      'public.ordre_customer_seq',
      (SELECT GREATEST(
        COALESCE(MAX(ordrenr), 0),
        COALESCE((SELECT last_value FROM public.ordre_customer_seq), 0)
      ) FROM public.ordre),
      true
    );
  END IF;
END $$;
