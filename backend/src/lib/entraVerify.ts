import jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { z } from 'zod';
import { getEntraConfig } from './entra.js';

/**
 * Server-side validation of Microsoft Entra ID tokens.
 *
 * The SPA (MSAL + PKCE) sends its ID token to `POST /api/auth/entra`; this
 * module verifies the RS256 signature against the tenant JWKS and enforces
 * audience (`aud` === our client ID), issuer, tenant (`tid`) and expiry.
 * Only then is the local token pair issued — the Entra token itself is never
 * accepted as an API credential and never stored.
 *
 * @module lib/entraVerify
 */

/** Thrown when a presented Microsoft token cannot be trusted. */
export class EntraVerificationError extends Error {
  constructor(message = 'Invalid Microsoft sign-in token') {
    super(message);
    this.name = 'EntraVerificationError';
  }
}

const entraClaimsSchema = z.object({
  oid: z.string().min(1),
  tid: z.string().min(1),
  preferred_username: z.string().min(1).max(320).optional(),
  email: z.string().min(1).max(320).optional(),
  upn: z.string().min(1).max(320).optional(),
  name: z.string().max(200).optional(),
});

export interface EntraIdentity {
  /** Immutable Microsoft object ID — the link key (`users.entra_oid`). */
  oid: string;
  tenantId: string;
  /** Best human identifier for admin display / support. */
  loginHint: string;
  displayName?: string;
}

let jwksClient: JwksClient | null = null;
let jwksUriForClient: string | null = null;

function clientFor(jwksUri: string): JwksClient {
  if (!jwksClient || jwksUriForClient !== jwksUri) {
    jwksClient = new JwksClient({
      jwksUri,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600_000,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      timeout: 10_000,
    });
    jwksUriForClient = jwksUri;
  }
  return jwksClient;
}

/** Test-only: drop the cached JWKS client (forces re-creation). */
export function __resetEntraJwksForTests(): void {
  jwksClient = null;
  jwksUriForClient = null;
}

function decodeKid(idToken: string): string {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === 'string') {
    throw new EntraVerificationError();
  }
  const { alg, kid } = decoded.header as { alg?: string; kid?: string };
  // Explicit algorithm gate: 'none' (or anything but RS256) never verifies.
  if (alg !== 'RS256' || !kid) {
    throw new EntraVerificationError();
  }
  return kid;
}

/**
 * Verify an Entra ID token and return the caller's identity.
 * @throws EntraVerificationError when the token cannot be trusted.
 * @throws Error when Entra sign-in is not enabled/configured.
 */
export async function verifyEntraIdToken(idToken: string): Promise<EntraIdentity> {
  const config = getEntraConfig();
  if (!config) {
    throw new Error('Microsoft sign-in is not enabled');
  }
  if (!idToken || typeof idToken !== 'string' || idToken.length > 8000) {
    throw new EntraVerificationError();
  }

  const kid = decodeKid(idToken);
  let publicKey: string;
  try {
    const key = await clientFor(config.jwksUri).getSigningKey(kid);
    publicKey = key.getPublicKey();
  } catch {
    throw new EntraVerificationError();
  }

  let claims: z.infer<typeof entraClaimsSchema>;
  try {
    const verified = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience: config.clientId,
      issuer: config.issuer,
      clockTolerance: 120,
    });
    claims = entraClaimsSchema.parse(verified);
  } catch {
    // Covers bad signature, wrong aud/iss, expiry AND malformed claims —
    // all untrusted, all the same generic error (no oracle for attackers).
    throw new EntraVerificationError();
  }

  // Single-tenant enforcement: a token minted for another tenant (even with
  // a colliding app registration) must never authenticate here.
  if (claims.tid !== config.tenantId) {
    throw new EntraVerificationError();
  }

  const loginHint = claims.preferred_username ?? claims.email ?? claims.upn ?? claims.oid;
  return {
    oid: claims.oid,
    tenantId: claims.tid,
    loginHint,
    ...(claims.name ? { displayName: claims.name } : {}),
  };
}
