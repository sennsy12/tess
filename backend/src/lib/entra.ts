import { z } from 'zod';

/**
 * Microsoft Entra ID (single-tenant) configuration.
 *
 * Hybrid auth: local username/password login keeps working exactly as before.
 * Entra ID is an additional sign-in path — the frontend acquires an ID token
 * via MSAL (public SPA client, PKCE) and the backend validates it against the
 * tenant JWKS, then issues the SAME local access + refresh token pair as a
 * password login. Roles stay in the local `users` table; an admin links a
 * Microsoft account (`entra_oid`) to a user before it can sign in.
 *
 * Only the client/tenant IDs are ever exposed to the browser (via
 * `GET /api/auth/entra/config`); there is no client secret involved.
 *
 * @module lib/entra
 */

const entraEnvSchema = z.object({
  ENABLE_ENTRA: z.string().optional(),
  ENTRA_TENANT_ID: z.string().uuid().optional(),
  ENTRA_CLIENT_ID: z.string().uuid().optional(),
});

export interface EntraConfig {
  tenantId: string;
  clientId: string;
  issuer: string;
  jwksUri: string;
}

let cached: EntraConfig | null | undefined;

function readConfig(): EntraConfig | null {
  const parsed = entraEnvSchema.safeParse(process.env);
  if (!parsed.success) return null;
  const { ENABLE_ENTRA, ENTRA_TENANT_ID, ENTRA_CLIENT_ID } = parsed.data;
  if (ENABLE_ENTRA !== 'true') return null;
  if (!ENTRA_TENANT_ID || !ENTRA_CLIENT_ID) return null;
  const issuer = `https://login.microsoftonline.com/${ENTRA_TENANT_ID}/v2.0`;
  return {
    tenantId: ENTRA_TENANT_ID,
    clientId: ENTRA_CLIENT_ID,
    issuer,
    jwksUri: `${issuer}/discovery/v2.0/keys`,
  };
}

/** Entra config when enabled, otherwise null. Cached per process. */
export function getEntraConfig(): EntraConfig | null {
  if (cached === undefined) cached = readConfig();
  return cached;
}

/** True when Microsoft sign-in is switched on AND fully configured. */
export function isEntraEnabled(): boolean {
  return getEntraConfig() !== null;
}

/** Test-only: drop the cached parse so subsequent calls re-read process.env. */
export function __resetEntraConfigForTests(): void {
  cached = undefined;
}
