import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { getEntraConfig, isEntraEnabled, __resetEntraConfigForTests } from '../entra';
import {
  verifyEntraIdToken,
  EntraVerificationError,
  __resetEntraJwksForTests,
} from '../entraVerify';

const mockGetSigningKey = jest.fn();

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: (...args: unknown[]) => mockGetSigningKey(...args),
  })),
}));

const TENANT_ID = '11111111-1111-4111-8111-111111111111';
const CLIENT_ID = '22222222-2222-4222-8222-222222222222';
const ISSUER = `https://login.microsoftonline.com/${TENANT_ID}/v2.0`;
const KID = 'test-key-1';
const OID = '99999999-9999-9999-9999-999999999999';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function saveEnv(): Record<string, string | undefined> {
  return {
    ENABLE_ENTRA: process.env.ENABLE_ENTRA,
    ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID,
    ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID,
  };
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  __resetEntraConfigForTests();
  __resetEntraJwksForTests();
}

function enableEntra(): void {
  process.env.ENABLE_ENTRA = 'true';
  process.env.ENTRA_TENANT_ID = TENANT_ID;
  process.env.ENTRA_CLIENT_ID = CLIENT_ID;
  __resetEntraConfigForTests();
  __resetEntraJwksForTests();
}

function signEntraToken(overrides: Record<string, unknown> = {}, signOpts: Record<string, unknown> = {}): string {
  return jwt.sign(
    {
      oid: OID,
      tid: TENANT_ID,
      preferred_username: 'ada@contoso.no',
      ...overrides,
    },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: KID,
      audience: CLIENT_ID,
      issuer: ISSUER,
      expiresIn: '1h',
      ...signOpts,
    }
  );
}

describe('entra config', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = saveEnv();
    delete process.env.ENABLE_ENTRA;
    delete process.env.ENTRA_TENANT_ID;
    delete process.env.ENTRA_CLIENT_ID;
    __resetEntraConfigForTests();
  });

  afterEach(() => restoreEnv(saved));

  it('is disabled by default', () => {
    expect(getEntraConfig()).toBeNull();
    expect(isEntraEnabled()).toBe(false);
  });

  it('is enabled with valid tenant and client IDs', () => {
    enableEntra();
    expect(getEntraConfig()).toEqual({
      tenantId: TENANT_ID,
      clientId: CLIENT_ID,
      issuer: ISSUER,
      jwksUri: `${ISSUER}/discovery/v2.0/keys`,
    });
    expect(isEntraEnabled()).toBe(true);
  });

  it('stays disabled when IDs are missing or malformed', () => {
    process.env.ENABLE_ENTRA = 'true';
    __resetEntraConfigForTests();
    expect(getEntraConfig()).toBeNull();

    process.env.ENTRA_TENANT_ID = 'not-a-uuid';
    process.env.ENTRA_CLIENT_ID = CLIENT_ID;
    __resetEntraConfigForTests();
    expect(getEntraConfig()).toBeNull();
  });

  it('stays disabled when the flag is not exactly "true"', () => {
    process.env.ENABLE_ENTRA = '1';
    process.env.ENTRA_TENANT_ID = TENANT_ID;
    process.env.ENTRA_CLIENT_ID = CLIENT_ID;
    __resetEntraConfigForTests();
    expect(getEntraConfig()).toBeNull();
  });
});

describe('verifyEntraIdToken', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = saveEnv();
    mockGetSigningKey.mockResolvedValue({ getPublicKey: () => publicKey });
  });

  afterEach(() => restoreEnv(saved));

  it('throws when Entra sign-in is not enabled', async () => {
    delete process.env.ENABLE_ENTRA;
    __resetEntraConfigForTests();
    await expect(verifyEntraIdToken('whatever')).rejects.toThrow(
      'Microsoft sign-in is not enabled'
    );
  });

  it('rejects malformed and unsigned tokens', async () => {
    enableEntra();
    await expect(verifyEntraIdToken('not-a-jwt')).rejects.toThrow(EntraVerificationError);
    await expect(verifyEntraIdToken('')).rejects.toThrow(EntraVerificationError);
    // alg=none must never verify
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ oid: OID, tid: TENANT_ID })).toString('base64url');
    await expect(verifyEntraIdToken(`${header}.${payload}.`)).rejects.toThrow(
      EntraVerificationError
    );
    expect(mockGetSigningKey).not.toHaveBeenCalled();
  });

  it('returns the identity for a valid token', async () => {
    enableEntra();
    const identity = await verifyEntraIdToken(signEntraToken());
    expect(identity).toEqual({
      oid: OID,
      tenantId: TENANT_ID,
      loginHint: 'ada@contoso.no',
    });
    expect(mockGetSigningKey).toHaveBeenCalledWith(KID);
  });

  it('falls back to email/upn login hints', async () => {
    enableEntra();
    const byEmail = await verifyEntraIdToken(
      signEntraToken({ preferred_username: undefined, email: 'a@b.no' })
    );
    expect(byEmail.loginHint).toBe('a@b.no');
  });

  it('rejects wrong audience, issuer, tenant and expiry', async () => {
    enableEntra();
    await expect(
      verifyEntraIdToken(signEntraToken({}, { audience: 'other-client' }))
    ).rejects.toThrow(EntraVerificationError);
    await expect(
      verifyEntraIdToken(signEntraToken({}, { issuer: 'https://evil.example.com' }))
    ).rejects.toThrow(EntraVerificationError);
    await expect(verifyEntraIdToken(signEntraToken({ tid: 'other-tenant' }))).rejects.toThrow(
      EntraVerificationError
    );
    await expect(
      verifyEntraIdToken(signEntraToken({}, { expiresIn: '-1h' }))
    ).rejects.toThrow(EntraVerificationError);
  });

  it('rejects tokens without oid and unknown signing keys', async () => {
    enableEntra();
    // oid: undefined is dropped from the JWT payload by jsonwebtoken.
    await expect(
      verifyEntraIdToken(signEntraToken({ oid: undefined }))
    ).rejects.toThrow(EntraVerificationError);

    mockGetSigningKey.mockRejectedValueOnce(new Error('key not found'));
    await expect(verifyEntraIdToken(signEntraToken())).rejects.toThrow(
      EntraVerificationError
    );
  });
});
