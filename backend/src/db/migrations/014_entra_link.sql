-- 014_entra_link.sql
-- Microsoft Entra ID (hybrid auth): link local users to Entra accounts.
--
-- Hybrid-modell: lokal brukernavn/passord-login fortsetter som før. Entra ID
-- er en ekstra innloggingsvei — frontend henter ID-token via MSAL (SPA +
-- PKCE), backend validerer det mot tenant-JWKS og utsteder SAMME lokale
-- token-par som passord-login. Roller ligger fortsatt i users.role.
--
-- Sikkerhet: en Microsoft-konto kan KUN logge inn når en admin eksplisitt
-- har koblet dens immutable object ID (entra_oid) til en bruker
-- (POST /api/users/:id/entra-link). Ingen auto-oppretting/JIT — ukjent
-- entra_oid gir 403, aldri ny bruker. PostgreSQL tillater flere NULL i
-- UNIQUE-kolonnen, så ukoblede brukere (entra_oid IS NULL) er upåvirket.

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entra_oid TEXT UNIQUE;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entra_upn TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS entra_linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_entra_oid
  ON public.users (entra_oid);
