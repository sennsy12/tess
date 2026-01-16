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

-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt, rounds=10
INSERT INTO public.users (username, password_hash, role) 
VALUES ('admin', '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W', 'admin')
ON CONFLICT (username) DO NOTHING;

-- Insert default analyse user (password: analyse123)
INSERT INTO public.users (username, password_hash, role) 
VALUES ('analyse', '$2b$10$rQZ7.HxSJvtAcMxGmsDKqO1F3tJ1X6W5H1qKjE5J9q8K7.7Wb5rXe', 'analyse')
ON CONFLICT (username) DO NOTHING;

-- Sample data for testing
INSERT INTO public.kunde (kundenr, kundenavn) VALUES 
('kunde1', 'Nordisk Handel AS'),
('K002', 'Bergen Industri'),
('K003', 'Oslo Leverandør')
ON CONFLICT DO NOTHING;

INSERT INTO public.firma (firmaid, firmanavn) VALUES 
(1, 'Hovedkontor'),
(2, 'Avdeling Nord'),
(3, 'Avdeling Sør')
ON CONFLICT DO NOTHING;

INSERT INTO public.lager (lagernavn, firmaid) VALUES 
('Hovedlager', 1),
('Nordlager', 2),
('Sørlager', 3)
ON CONFLICT DO NOTHING;

INSERT INTO public.valuta (valutaid) VALUES 
('NOK'),
('EUR'),
('USD')
ON CONFLICT DO NOTHING;

INSERT INTO public.vare (varekode, varenavn, varegruppe) VALUES 
('V001', 'Produkt A', 'Elektronikk'),
('V002', 'Produkt B', 'Elektronikk'),
('V003', 'Produkt C', 'Møbler'),
('V004', 'Produkt D', 'Møbler'),
('V005', 'Produkt E', 'Verktøy')
ON CONFLICT DO NOTHING;

INSERT INTO public.ordre (ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum) VALUES 
(1001, '2024-01-15', 'kunde1', 'REF-001', 'Kontakt A', 1, 'Hovedlager', 'NOK', 15000.00),
(1002, '2024-01-20', 'K002', 'REF-002', 'Kontakt B', 2, 'Nordlager', 'NOK', 25000.00),
(1003, '2024-02-01', 'kunde1', 'REF-003', 'Kontakt A', 1, 'Hovedlager', 'EUR', 8500.00),
(1004, '2024-02-15', 'K003', 'REF-004', 'Kontakt C', 3, 'Sørlager', 'NOK', 32000.00),
(1005, '2024-03-01', 'K002', 'REF-005', 'Kontakt B', 2, 'Nordlager', 'USD', 12000.00)
ON CONFLICT DO NOTHING;

INSERT INTO public.ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus) VALUES 
(1, 1001, 'V001', 5, 'stk', 1000.00, 5000.00, 1),
(2, 1001, 'V002', 10, 'stk', 1000.00, 10000.00, 1),
(1, 1002, 'V003', 3, 'stk', 5000.00, 15000.00, 1),
(2, 1002, 'V004', 2, 'stk', 5000.00, 10000.00, 1),
(1, 1003, 'V001', 8, 'stk', 1062.50, 8500.00, 1),
(1, 1004, 'V005', 16, 'stk', 2000.00, 32000.00, 1),
(1, 1005, 'V002', 12, 'stk', 1000.00, 12000.00, 1)
ON CONFLICT DO NOTHING;

INSERT INTO public.ordre_henvisning (ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5) VALUES 
(1001, 1, 'Prosjekt Alpha', 'Avdeling A', NULL, NULL, NULL),
(1001, 2, 'Prosjekt Alpha', 'Avdeling A', 'Fase 1', NULL, NULL),
(1002, 1, 'Prosjekt Beta', 'Avdeling B', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Insert a kunde user that maps to kunde K001 (password: kunde123)
INSERT INTO public.users (username, password_hash, role, kundenr) 
VALUES ('kunde001', '$2b$10$1GxjN.xjpf50bD8bV9W/8OZo9K/IxCP1H9XwvCJ1pIP.1cf8H/xD.', 'kunde', 'kunde1')
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

COMMIT;

