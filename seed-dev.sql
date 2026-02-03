-- ============================================================
-- DEVELOPMENT SEED DATA
-- This file is for LOCAL DEVELOPMENT ONLY
-- DO NOT run this in production!
-- ============================================================

-- Development/test users
-- Password: admin123 (same as admin for dev simplicity)
INSERT INTO public.users (username, password_hash, role) 
VALUES ('analyse', '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W', 'analyse')
ON CONFLICT (username) DO NOTHING;

-- Sample customers
INSERT INTO public.kunde (kundenr, kundenavn) VALUES 
('kunde1', 'Nordisk Handel AS'),
('K002', 'Bergen Industri'),
('K003', 'Oslo Leverandør')
ON CONFLICT DO NOTHING;

-- Sample firma
INSERT INTO public.firma (firmaid, firmanavn) VALUES 
(1, 'Hovedkontor'),
(2, 'Avdeling Nord'),
(3, 'Avdeling Sør')
ON CONFLICT DO NOTHING;

-- Sample lager
INSERT INTO public.lager (lagernavn, firmaid) VALUES 
('Hovedlager', 1),
('Nordlager', 2),
('Sørlager', 3)
ON CONFLICT DO NOTHING;

-- Sample products
INSERT INTO public.vare (varekode, varenavn, varegruppe) VALUES 
('V001', 'Produkt A', 'Elektronikk'),
('V002', 'Produkt B', 'Elektronikk'),
('V003', 'Produkt C', 'Møbler'),
('V004', 'Produkt D', 'Møbler'),
('V005', 'Produkt E', 'Verktøy')
ON CONFLICT DO NOTHING;

-- Sample orders
INSERT INTO public.ordre (ordrenr, dato, kundenr, kundeordreref, kunderef, firmaid, lagernavn, valutaid, sum) VALUES 
(1001, '2024-01-15', 'kunde1', 'REF-001', 'Kontakt A', 1, 'Hovedlager', 'NOK', 15000.00),
(1002, '2024-01-20', 'K002', 'REF-002', 'Kontakt B', 2, 'Nordlager', 'NOK', 25000.00),
(1003, '2024-02-01', 'kunde1', 'REF-003', 'Kontakt A', 1, 'Hovedlager', 'EUR', 8500.00),
(1004, '2024-02-15', 'K003', 'REF-004', 'Kontakt C', 3, 'Sørlager', 'NOK', 32000.00),
(1005, '2024-03-01', 'K002', 'REF-005', 'Kontakt B', 2, 'Nordlager', 'USD', 12000.00)
ON CONFLICT DO NOTHING;

-- Sample order lines
INSERT INTO public.ordrelinje (linjenr, ordrenr, varekode, antall, enhet, nettpris, linjesum, linjestatus) VALUES 
(1, 1001, 'V001', 5, 'stk', 1000.00, 5000.00, 1),
(2, 1001, 'V002', 10, 'stk', 1000.00, 10000.00, 1),
(1, 1002, 'V003', 3, 'stk', 5000.00, 15000.00, 1),
(2, 1002, 'V004', 2, 'stk', 5000.00, 10000.00, 1),
(1, 1003, 'V001', 8, 'stk', 1062.50, 8500.00, 1),
(1, 1004, 'V005', 16, 'stk', 2000.00, 32000.00, 1),
(1, 1005, 'V002', 12, 'stk', 1000.00, 12000.00, 1)
ON CONFLICT DO NOTHING;

-- Sample references
INSERT INTO public.ordre_henvisning (ordrenr, linjenr, henvisning1, henvisning2, henvisning3, henvisning4, henvisning5) VALUES 
(1001, 1, 'Prosjekt Alpha', 'Avdeling A', NULL, NULL, NULL),
(1001, 2, 'Prosjekt Alpha', 'Avdeling A', 'Fase 1', NULL, NULL),
(1002, 1, 'Prosjekt Beta', 'Avdeling B', NULL, NULL, NULL)
ON CONFLICT DO NOTHING;

-- Sample kunde user (password: admin123 - same as admin for dev simplicity)
INSERT INTO public.users (username, password_hash, role, kundenr) 
VALUES ('kunde001', '$2b$10$55MITFPNmmdu9pau6zk9Iul2mIJU0g.hJccUnCfYT.9ChAfcUz20W', 'kunde', 'kunde1')
ON CONFLICT (username) DO NOTHING;

-- Assign sample customers to groups
UPDATE public.kunde SET customer_group_id = 1 WHERE kundenr = 'kunde1';
UPDATE public.kunde SET customer_group_id = 2 WHERE kundenr = 'K002';
UPDATE public.kunde SET customer_group_id = 3 WHERE kundenr = 'K003';
