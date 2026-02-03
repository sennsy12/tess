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
    varegruppe text
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
    sum double precision,
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
    antall real,
    enhet text,
    nettpris double precision,
    linjesum double precision,
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

-- NOTE: Admin user should be created securely during deployment
-- Do NOT use these default passwords in production!
-- Use: node backend/src/scripts/genHash.js <your-secure-password>

-- Default admin user for initial setup only (password: admin123)
-- CHANGE THIS PASSWORD IMMEDIATELY AFTER FIRST LOGIN
INSERT INTO public.users (username, password_hash, role) 
VALUES ('admin', '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W', 'admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- PERFORMANCE INDEXES (Critical for millions of rows)
-- ============================================================

-- Ordre indexes (most queried table)
CREATE INDEX IF NOT EXISTS idx_ordre_kundenr ON public.ordre(kundenr);
CREATE INDEX IF NOT EXISTS idx_ordre_dato ON public.ordre(dato DESC);
CREATE INDEX IF NOT EXISTS idx_ordre_firmaid ON public.ordre(firmaid);
CREATE INDEX IF NOT EXISTS idx_ordre_lagernavn ON public.ordre(lagernavn);
CREATE INDEX IF NOT EXISTS idx_ordre_kundenr_dato ON public.ordre(kundenr, dato DESC);

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

COMMIT;

