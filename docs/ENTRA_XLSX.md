# Entra ID hybrid sign-in + XLSX import

Two additive features. Existing behavior (local login, CSV/JSON/API ingest) is
unchanged; both features degrade gracefully when unconfigured.

## 1. Microsoft Entra ID (hybrid auth)

Local username/password login keeps working exactly as before. Entra ID is an
additional sign-in path that ends in the **same** local access + refresh token
pair (identical session semantics, role guards, `token_version` revocation).

### 1.1 Azure setup (once per tenant)

1. Microsoft Entra admin center → **App registrations** → New (single tenant).
2. **Authentication** → Add platform **Single-page application**:
   - dev: `http://localhost:3000`
   - prod: `https://yourdomain.com`
   - Flow: authorization code + PKCE (MSAL default; no secret needed).
3. Note **Directory (tenant) ID** and **Application (client) ID**.
4. Optional: **Token configuration** → optional claims `email`, `upn`,
   `preferred_username` (improves the admin-visible link hint).

### 1.2 Backend configuration

```bash
ENABLE_ENTRA=true
ENTRA_TENANT_ID=<tenant-id-uuid>
ENTRA_CLIENT_ID=<client-id-uuid>
```

`GET /api/auth/entra/config` then returns
`{ enabled: true, clientId, tenantId }` (public SPA values, no secrets).
With `ENABLE_ENTRA=false` (default) it returns `{ enabled: false }` and
`POST /api/auth/entra` answers 503.

### 1.3 Linking accounts (admin)

No JIT provisioning by design — an admin links each Microsoft account first:

```http
POST /api/users/:id/entra-link
{ "entraOid": "<immutable Entra object ID>", "entraUpn": "ada@contoso.no", "actionKey": "<ADMIN_ACTION_KEY>" }

DELETE /api/users/:id/entra-link
{ "actionKey": "<ADMIN_ACTION_KEY>" }
```

Find `entraOid` in Entra admin center (user → Object ID). Linking requires
the admin action key (same bar as password changes). A duplicate link across
two users is rejected (409); linking the same user twice just updates it.

### 1.4 Sign-in flow

1. Login page fetches `/auth/entra/config`; the **Logg inn med Microsoft**
   button appears only when enabled (local login never depends on Entra).
2. MSAL popup (SSO silent when a Microsoft session exists) → ID token.
3. `POST /api/auth/entra { idToken }` → backend validates RS256 signature
   against the tenant JWKS (cached, rate-limited), enforces
   `aud`/`iss`/`tid`/expiry, requires a linked user → `{ token,
   refreshToken, user }`.
4. Unlinked account → **403** ("contact administrator"). Bad token → 401.
5. Logout revokes the local refresh token and best-effort signs out of
   Microsoft (never blocks local logout).

### 1.5 Security properties

- `alg` pinned to RS256 (`none` rejected before key lookup).
- Single-tenant enforcement (`tid` must equal configured tenant).
- 120s clock tolerance; JWKS cached 10 min, 10 req/min upstream cap.
- Brute-force protected by the shared `authLimiter`.
- DB: migration `014_entra_link.sql` (`users.entra_oid UNIQUE`,
  `entra_upn`, `entra_linked_at`). Multiple NULLs allowed, so unlinked users
  are unaffected.

## 2. XLSX import (streaming)

Same tables and semantics as CSV (`ordre, ordrelinje, kunde, vare, firma,
lager`, incl. combined order+line fan-out), new source type `xlsx`.

### 2.1 Endpoints (admin, same guards/rate limits as CSV)

```http
POST /api/etl/upload-xlsx          # multipart: file (+ optional table, sheet)
POST /api/etl/ingest               # { sourceType: "xlsx", table, xlsx: { sheet? }, ... }
```

- `sheet` defaults to the first worksheet; unknown names 400 with available
  sheets listed. `.xlsx`/`.xlsm` only (50 MB cap shared with CSV).
- Unified `/ingest` supports queued (202) and sync execution, checkpoints,
  dead-letter, SSE progress — identical to CSV.

### 2.2 Implementation notes

- `backend/src/etl/streaming/sources/xlsxSource.ts`: deterministic SAX
  reader (random access via zip central directory, `unzipper` + `saxes`).
  Streams the target sheet only — O(1) rows + O(unique strings). No temp
  files, no entry-order dependence (exceljs streaming was evaluated and
  rejected: racy temp-file deferral).
- Header detection + table inference shared with CSV
  (`detectTargetTable`); combined order/line via
  `combinedOrderXlsx.ts` (same FK-safe sequence as CSV).
- Native date cells surface as Excel serials; `parseDateLike` converts them
  (verbatim numerics never touch other columns).
- Frontend: **Bulk Data → Last opp XLSX** (file + optional sheet name).
  Reuses the result log and job invalidation.

### 2.3 Verification

```bash
cd backend && npx jest src/etl/__tests__/xlsxSource.test.ts \
  src/etl/__tests__/xlsxPipeline.test.ts src/lib/__tests__/entra.test.ts \
  src/tests/entra.test.ts
cd ../frontend && npx vitest run src/lib/auth/__tests__/msalClient.test.ts \
  src/context/__tests__/AuthContext.test.tsx
```
