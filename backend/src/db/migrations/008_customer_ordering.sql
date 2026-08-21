-- Customer ordering (kunde order placement)
-- 1. Catalog base price on products (source for pricing engine)
-- 2. Sequence for customer-placed order numbers (buffered above ETL-imported ordrenr)
-- 3. Idempotency key on ordre (double-submit protection)
-- 4. Extended workflow_status with approval states

-- ============================================
-- 1. PRODUCT BASE PRICE
-- ============================================
ALTER TABLE public.vare
  ADD COLUMN IF NOT EXISTS base_price DOUBLE PRECISION NOT NULL DEFAULT 0;

-- ============================================
-- 2. ORDER NUMBER SEQUENCE
-- Starts 10 000 above the highest imported ordrenr so future ETL
-- imports of historical data are unlikely to collide.
-- ============================================
DO $$
DECLARE
    start_val BIGINT;
BEGIN
    SELECT COALESCE(MAX(ordrenr), 0) + 10000 INTO start_val FROM public.ordre;
    IF to_regclass('public.ordre_customer_seq') IS NULL THEN
        EXECUTE format('CREATE SEQUENCE public.ordre_customer_seq START WITH %s', start_val);
    END IF;
END $$;

-- ============================================
-- 3. IDEMPOTENCY KEY
-- ============================================
ALTER TABLE public.ordre ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ordre_idempotency_key
  ON public.ordre (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ============================================
-- 4. WORKFLOW STATUS EXTENSION
-- Replaces the CHECK constraint from init.sql / 007 with one that
-- also allows the customer-order approval states.
-- ============================================
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'ordre' AND column_name = 'workflow_status'
    ) THEN
        ALTER TABLE public.ordre
          ADD COLUMN workflow_status TEXT NOT NULL DEFAULT 'new';
        ALTER TABLE public.ordre
          ADD COLUMN status_updated_at TIMESTAMPTZ;
    END IF;

    -- Drop any pre-existing single-column workflow_status CHECK constraint
    FOR constraint_name IN
        SELECT con.conname
        FROM pg_constraint con
        JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
        WHERE con.conrelid = 'public.ordre'::regclass
          AND con.contype = 'c'
          AND att.attname = 'workflow_status'
    LOOP
        EXECUTE format('ALTER TABLE public.ordre DROP CONSTRAINT %I', constraint_name);
    END LOOP;

    ALTER TABLE public.ordre
      ADD CONSTRAINT ordre_workflow_status_extended_check
      CHECK (workflow_status IN (
        'new', 'pending_approval', 'approved', 'rejected',
        'processing', 'shipped', 'invoiced', 'cancelled'
      ));
END $$;

-- Pending-approval queue index (admin approval inbox)
CREATE INDEX IF NOT EXISTS idx_ordre_pending_approval
  ON public.ordre (status_updated_at DESC)
  WHERE workflow_status = 'pending_approval';
