-- Initialize the database with the schema
BEGIN;

-- Dropping tables if they exist, starting with tables that have foreign key dependencies
DROP TABLE IF EXISTS public.ordrelinje CASCADE;
DROP TABLE IF EXISTS public.ordre CASCADE;
DROP TABLE IF EXISTS public.lager CASCADE;
DROP TABLE IF EXISTS public.firma CASCADE;
DROP TABLE IF EXISTS public.vare CASCADE;
DROP TABLE IF EXISTS public.valuta CASCADE;
DROP TABLE IF EXISTS public.kunde CASCADE;
DROP TABLE IF EXISTS public.ordre_henvisning CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Users table for authentication
CREATE TABLE IF NOT EXISTS public.users
(
    id SERIAL PRIMARY KEY,
    username text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('admin', 'kunde', 'analyse')),
    kundenr text,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.kunde
(
    kundenr text PRIMARY KEY,
    kundenavn text
);

CREATE TABLE IF NOT EXISTS public.firma
(
    firmaid integer PRIMARY KEY,
    firmanavn text
);

CREATE TABLE IF NOT EXISTS public.lager
(
    lagernavn text,
    firmaid integer,
    PRIMARY KEY (lagernavn, firmaid),
    FOREIGN KEY (firmaid) REFERENCES public.firma(firmaid)
);

CREATE TABLE IF NOT EXISTS public.valuta
(
    valutaid text PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS public.vare
(
    varekode text PRIMARY KEY,
    varenavn text,
    varegruppe text,
    base_price DECIMAL(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.ordre
(
    ordrenr integer PRIMARY KEY,
    dato date,
    kundenr text,
    kundeordreref text,
    kunderef text,
    firmaid integer,
    lagernavn text,
    valutaid text,
    sum DECIMAL(12,2),
    workflow_status text NOT NULL DEFAULT 'new'
        CHECK (workflow_status IN ('new', 'pending_approval', 'approved', 'rejected', 'processing', 'shipped', 'invoiced', 'cancelled')),
    status_updated_at TIMESTAMP,
    idempotency_key text,
    FOREIGN KEY (kundenr) REFERENCES public.kunde(kundenr),
    FOREIGN KEY (firmaid) REFERENCES public.firma(firmaid),
    FOREIGN KEY (lagernavn, firmaid) REFERENCES public.lager(lagernavn, firmaid),
    FOREIGN KEY (valutaid) REFERENCES public.valuta(valutaid)
);

CREATE TABLE IF NOT EXISTS public.ordrelinje
(
    linjenr integer,
    ordrenr integer,
    varekode text,
    antall DECIMAL(12,3),
    enhet text,
    nettpris DECIMAL(12,2),
    linjesum DECIMAL(12,2),
    linjestatus integer,
    PRIMARY KEY (linjenr, ordrenr),
    FOREIGN KEY (ordrenr) REFERENCES public.ordre(ordrenr),
    FOREIGN KEY (varekode) REFERENCES public.vare(varekode)
);

CREATE TABLE IF NOT EXISTS public.ordre_henvisning
(
    ordrenr integer,
    linjenr integer,
    henvisning1 text,
    henvisning2 text,
    henvisning3 text,
    henvisning4 text,
    henvisning5 text,
    PRIMARY KEY (ordrenr, linjenr),
    FOREIGN KEY (ordrenr, linjenr) REFERENCES public.ordrelinje(ordrenr, linjenr)
);

CREATE TABLE IF NOT EXISTS public.saved_reports
(
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES public.users(id),
    name text NOT NULL,
    config jsonb NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MINIMAL PRODUCTION DATA
-- Only essential system data - no test/sample data
-- For development seed data, see seed-dev.sql
-- ============================================================

-- Insert common currencies (required for FK constraints)
INSERT INTO public.valuta (valutaid) VALUES 
('NOK'),
('EUR'),
('USD'),
('SEK'),
('DKK'),
('GBP')
ON CONFLICT DO NOTHING;

-- NOTE: No admin user is seeded here. The first admin account is created
-- securely at backend startup from ADMIN_USERNAME / ADMIN_PASSWORD env vars
-- (see backend/src/db/bootstrapAdmin.ts). In production, ADMIN_PASSWORD is
-- REQUIRED (min 12 chars) or the server refuses to start.

-- ============================================================
-- PERFORMANCE INDEXES (Critical for millions of rows)
-- ============================================================

-- Ordre indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_ordre_kundenr ON public.ordre(kundenr);
CREATE INDEX IF NOT EXISTS idx_ordre_dato ON public.ordre(dato DESC);
CREATE INDEX IF NOT EXISTS idx_ordre_firmaid ON public.ordre(firmaid);
CREATE INDEX IF NOT EXISTS idx_ordre_lagernavn ON public.ordre(lagernavn);
CREATE INDEX IF NOT EXISTS idx_ordre_kundenr_dato ON public.ordre(kundenr, dato DESC);
-- Analytics composite indexes (from migration 002_statistics_indexes.sql)
CREATE INDEX IF NOT EXISTS idx_ordre_dato_kundenr ON public.ordre (dato, kundenr);
CREATE INDEX IF NOT EXISTS idx_ordre_dato_sum ON public.ordre (dato DESC) INCLUDE (sum, kundenr);
CREATE INDEX IF NOT EXISTS idx_ordrelinje_varekode_ordrenr ON public.ordrelinje (varekode, ordrenr) INCLUDE (linjesum, antall);

-- Ordrelinje indexes
CREATE INDEX IF NOT EXISTS idx_ordrelinje_ordrenr ON public.ordrelinje(ordrenr);
CREATE INDEX IF NOT EXISTS idx_ordrelinje_varekode ON public.ordrelinje(varekode);
CREATE INDEX IF NOT EXISTS idx_ordrelinje_linjestatus ON public.ordrelinje(linjestatus);

-- Vare indexes
CREATE INDEX IF NOT EXISTS idx_vare_varegruppe ON public.vare(varegruppe);

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_kundenr ON public.users(kundenr);

-- Ordre_henvisning indexes for text search
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h1 ON public.ordre_henvisning(henvisning1);
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h2 ON public.ordre_henvisning(henvisning2);

-- Partial indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ordre_active ON public.ordre(ordrenr) WHERE sum > 0;

-- Composite index for statistics queries
CREATE INDEX IF NOT EXISTS idx_ordrelinje_stats ON public.ordrelinje(ordrenr, varekode, linjesum);

-- ============================================
-- PRICING SYSTEM (from 001_pricing_system.sql)
-- ============================================

CREATE TABLE IF NOT EXISTS customer_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default groups
INSERT INTO customer_group (name, description) VALUES
    ('Standard', 'Default customer tier - standard pricing'),
    ('VIP', 'High-value customers with premium discounts'),
    ('Wholesale', 'Bulk buyers with volume-based discounts')
ON CONFLICT (name) DO NOTHING;

-- Link customers to groups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'kunde' AND column_name = 'customer_group_id'
    ) THEN
        ALTER TABLE kunde ADD COLUMN customer_group_id INTEGER REFERENCES customer_group(id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS price_list (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    valid_from TIMESTAMPTZ,
    valid_to TIMESTAMPTZ,
    priority INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_rule (
    id SERIAL PRIMARY KEY,
    price_list_id INTEGER NOT NULL REFERENCES price_list(id) ON DELETE CASCADE,
    varekode VARCHAR(50),
    varegruppe VARCHAR(50),
    kundenr VARCHAR(50),
    customer_group_id INTEGER REFERENCES customer_group(id),
    min_quantity INTEGER DEFAULT 1,
    discount_percent DECIMAL(5,2),
    fixed_price DECIMAL(12,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_discount_type CHECK (
        (discount_percent IS NOT NULL AND fixed_price IS NULL) OR
        (discount_percent IS NULL AND fixed_price IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_price_rule_varekode ON price_rule(varekode);
CREATE INDEX IF NOT EXISTS idx_price_rule_varegruppe ON price_rule(varegruppe);
CREATE INDEX IF NOT EXISTS idx_price_rule_kundenr ON price_rule(kundenr);
CREATE INDEX IF NOT EXISTS idx_price_rule_customer_group ON price_rule(customer_group_id);
CREATE INDEX IF NOT EXISTS idx_price_rule_price_list ON price_rule(price_list_id);
CREATE INDEX IF NOT EXISTS idx_price_list_active ON price_list(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_price_list_validity ON price_list(valid_from, valid_to);
CREATE INDEX IF NOT EXISTS idx_kunde_customer_group ON kunde(customer_group_id);

-- ============================================
-- AUDIT LOG (from 003_audit_log.sql)
-- ============================================

CREATE TABLE IF NOT EXISTS audit_log (
    id          BIGSERIAL PRIMARY KEY,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id     INTEGER REFERENCES users(id),
    username    VARCHAR(100) NOT NULL,
    action      VARCHAR(20) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id   VARCHAR(50) NOT NULL,
    entity_name VARCHAR(200),
    changes     JSONB,
    metadata    JSONB,
    ip_address  VARCHAR(45)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);

-- Trigram indexes for ILIKE search (see migration 004_trigram_search_indexes.sql)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_kunde_kundenavn_trgm ON public.kunde USING gin (kundenavn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_kunde_kundenr_trgm ON public.kunde USING gin (kundenr gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_kundeordreref_trgm ON public.ordre USING gin (kundeordreref gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_kunderef_trgm ON public.ordre USING gin (kunderef gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_kundenr_trgm ON public.ordre USING gin (kundenr gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vare_varekode_trgm ON public.vare USING gin (varekode gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vare_varenavn_trgm ON public.vare USING gin (varenavn gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h1_trgm ON public.ordre_henvisning USING gin (henvisning1 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h2_trgm ON public.ordre_henvisning USING gin (henvisning2 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h3_trgm ON public.ordre_henvisning USING gin (henvisning3 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h4_trgm ON public.ordre_henvisning USING gin (henvisning4 gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ordre_henvisning_h5_trgm ON public.ordre_henvisning USING gin (henvisning5 gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_ordre_workflow_status ON public.ordre(workflow_status);

-- Notifications (in-app alerts)
CREATE TABLE IF NOT EXISTS public.notifications (
    id BIGSERIAL PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    audience TEXT NOT NULL CHECK (audience IN ('admin', 'kunde')),
    kundenr TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notification_reads (
    notification_id BIGINT NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_audience ON public.notifications (audience, kundenr);

-- ETL job progress (durable)
CREATE TABLE IF NOT EXISTS public.etl_job_progress (
    job_id TEXT PRIMARY KEY,
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    table_name TEXT NOT NULL,
    source_type TEXT NOT NULL,
    attempted_rows BIGINT NOT NULL DEFAULT 0,
    inserted_rows BIGINT NOT NULL DEFAULT 0,
    rejected_rows BIGINT NOT NULL DEFAULT 0,
    dead_letter_count BIGINT NOT NULL DEFAULT 0,
    estimated_total BIGINT,
    error TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_etl_job_progress_updated_at ON public.etl_job_progress (updated_at DESC);

-- Order workflow history (dedicated timeline; see migration 012).
-- audit_log stays generic/best-effort; this table is the source of truth
-- for the order timeline incl. the decider's comment (e.g. reject reason).
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

COMMIT;

