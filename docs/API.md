# Tess API Reference

All endpoints are prefixed with `/api`.

Base URL (development): `http://localhost:5000/api`. Frontend default: `http://localhost:3000`.

Responses follow a consistent envelope:

```json
{ "status": "error", "error": "message" }            // errors
{ "data": [...], "pagination": { ... } }              // paginated lists
{ "data": { ... } }                                    // single resource
```

Paginated lists use `?page=` (1-based) and `?limit=`. Sorting uses `?sortBy=&sortDir=asc|desc` where supported.

## Conventions

- **Auth:** `Authorization: Bearer <accessToken>` unless marked Public.
- **Roles:** `admin` (full access), `kunde` (own orders only), `analyse` (read-only statistics).
- **Validation:** request bodies and query strings are validated with Zod. Validation failures return `400` with a descriptive error.
- **Correlation:** every response carries `x-request-id`. Include it when reporting errors.
- **Money:** all monetary values are `DECIMAL(12,2)` in JSON as numbers. Quantities are `DECIMAL(12,3)`.

## Rate limits (skipped in development)

| Limiter | Window | Max | Applies to |
|---------|--------|-----|------------|
| `generalLimiter` | 15 min | 1000 req | All `/api/*` |
| `authLimiter` | 15 min | 10 req | `POST /auth/login*`, `/auth/refresh` |
| `searchLimiter` | 1 min | 60 req | `/suggestions/search`, `GET /catalog/products` |
| `etlLimiter` | 1 hour | 20 req | All `/etl/*` |
| `assistantLimiter` | 1 hour | 30 req/user (200 in dev) | `POST /assistant/chat` |
| `orderCreateLimiter` | 1 hour | 60 req/user (200 in dev) | `POST /orders` |

Rate-limited responses return `429 { error }` with standard `RateLimit-*` headers.

## Authentication

All requests (except `/auth/login*`, `/auth/refresh`, `/auth/logout`, `/health`, `/health/ready`, `/metrics` and `POST /client-events`) require a `Bearer` token.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | Public (rate-limited) | Login for admin / analyse users. Body: `{ username, password }`. Returns `{ token, refreshToken, user }` |
| `POST` | `/auth/login-kunde` | Public (rate-limited) | Login for customer users. Body: `{ kundenr, password }`. Returns `{ token, refreshToken, user }` |
| `POST` | `/auth/refresh` | Refresh token (rate-limited) | Exchange a refresh token for a new pair. Body: `{ refreshToken }`. The presented token is consumed (rotated); reuse fails with 401 |
| `POST` | `/auth/logout` | Refresh token | Revoke a refresh token. Body: `{ refreshToken }`. Idempotent |
| `GET` | `/auth/verify` | Token | Verify the current JWT is still valid. Returns `{ valid, user }` |
| `POST` | `/auth/change-password` | Token | Change own password. Body: `{ currentPassword, newPassword(min 8) }`. Bumps `token_version` and revokes all refresh tokens — every existing session is signed out |

### Token lifecycle

- **Access tokens** are short-lived JWTs (1h). Claims: `{ id, username, role, kundenr?, tokenVersion }`. Every authenticated request checks `tokenVersion` against the DB value (30s cache); mismatch returns `401 { error: "Token revoked, please sign in again" }`.
- **Refresh tokens** are opaque 64-char strings stored server-side as SHA-256 hashes (`refresh_tokens` table), valid 7 days and rotated on every use.
- **Password change** bumps `token_version` and revokes all of the user's refresh tokens.
- The frontend automatically refreshes expired access tokens via a single-flight axios interceptor and replays the failed request once.
- Dummy-hash comparison is used on failed logins to mitigate user enumeration.

Example:

```bash
curl -X POST http://localhost:5000/api/auth/login-kunde \
  -H 'Content-Type: application/json' \
  -d '{ "kundenr": "K001", "password": "kunde123" }'
```

## Users (admin only)

All routes require `authMiddleware` + `roleGuard('admin')`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/users?page=&limit=` | List all users (paginated, default 20/page) |
| `GET` | `/users/search?q=` | Search users by username/kundenr |
| `GET` | `/users/:id` | Get a single user by ID |
| `POST` | `/users` | Create a user. Body: `{ username, password, role: admin\|kunde\|analyse, kundenr? }` |
| `PUT` | `/users/:id` | Update user fields (`username/password/role/kundenr`) |
| `DELETE` | `/users/:id` | Delete a user permanently |

## Orders

Role scoping: `kunde` users only see their own `kundenr`. `analyse` has no order access except via statistics.

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| `GET` | `/orders` | `authMiddleware`, `validate(orderQuerySchema)` | List orders (filtered, paginated, role-scoped). Query: `search, kundenr, ordrenr, firmaid, lagernavn, kundeordreref, kunderef, startDate, endDate, workflowStatus, sortBy, sortDir, page, limit` |
| `GET` | `/orders/statuses` | `authMiddleware` | Workflow metadata `{ value, label }` (Norwegian labels) |
| `GET` | `/orders/search/references?q=` | `authMiddleware`, `validate(searchQuerySchema)` | Search across `ordre_henvisning` (henvisning1-5). Must be called before `/:ordrenr` routing |
| `POST` | `/orders` | `authMiddleware`, `roleGuard('kunde','admin')`, `orderCreateLimiter`, `validate(createOrderSchema)` | Place a customer order from the cart. Body: `{ items: [{ varekode, antall }](1-200, no duplicates), kundeordreref?, kunderef?, lagernavn?, valutaid=NOK, idempotencyKey(8-64 alphanum), kundenr? (admin only) }`. Server re-prices every line; client prices are never trusted. Returns `{ ordrenr, workflow_status: pending_approval, sum, duplicate }` |
| `PATCH` | `/orders/:ordrenr/cancel` | `authMiddleware`, `roleGuard('kunde','admin')` | Cancel own cancellable order (`pending_approval`, `approved`). Appends a timeline row |
| `PATCH` | `/orders/:ordrenr/status` | `authMiddleware`, `roleGuard('admin')`, `validate(updateOrderStatusSchema)` | Change workflow status. Body: `{ workflowStatus, comment? }` — `comment` required when rejecting (max 500 chars). Illegal transitions return 409 |
| `GET` | `/orders/:ordrenr/history` | `authMiddleware` | Workflow timeline (who/when/from→to/comment), kunde-scoped — foreign orders return 404 |
| `GET` | `/orders/:ordrenr` | `authMiddleware` | Get a single order with its lines + `lineSummary` |

Workflow statuses: `new`, `pending_approval`, `approved`, `rejected`, `processing`, `shipped`, `invoiced`, `cancelled`. See `PROGRAMLOGIKK.md` for the transition map.

Example — place order (idempotent):

```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{ "items": [{ "varekode": "V001", "antall": 2 }], "valutaid": "NOK", "idempotencyKey": "abc12345XYZ" }'
```

## Order Lines

All mutating routes are admin-only. `GET` is role-scoped to the parent order.

| Method | Path | Middleware | Description |
|--------|------|-----------|-------------|
| `GET` | `/orderlines/order/:ordrenr?page=&limit=` | `authMiddleware` | Get paginated lines for an order |
| `POST` | `/orderlines` | `authMiddleware`, `roleGuard('admin')` | Create a line. Body: `{ ordrenr, varekode, antall, enhet?, nettpris, linjestatus? }`. Recalculates `ordre.sum` in the same transaction |
| `PUT` | `/orderlines/:ordrenr/:linjenr` | `authMiddleware`, `roleGuard('admin')` | Update a line (same fields). 404 if not found |
| `DELETE` | `/orderlines/:ordrenr/:linjenr` | `authMiddleware`, `roleGuard('admin')` | Delete a line. Returns `{ message, deleted }` |
| `PUT` | `/orderlines/:ordrenr/:linjenr/references` | `authMiddleware`, `roleGuard('admin')` | Upsert `henvisning1..henvisning5` for a line |

## Catalog (customer-facing prices)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/catalog/products?search=&varegruppe=&page=&limit=&sortBy=&sortDir=` | Token, `roleGuard('kunde','admin','analyse')`, `searchLimiter` | Product catalog with per-customer effective prices (pricing engine applied). `kunde` gets own prices; admin/analyse get base prices |

## Products (master data)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/products?page=&limit=&search=&sortBy=&sortDir=` | Token | List products (paginated, default sort `varenavn asc`) |
| `GET` | `/products/search?search=&...` | Token | Alias of `GET /products` (used by order-line product picker) |
| `GET` | `/products/groups` | Token | Distinct `varegruppe` values |
| `GET` | `/products/:varekode` | Token | Single product with `base_price` |
| `PATCH` | `/products/:varekode/price` | Token, `roleGuard('admin')`, `validate(updateProductPriceSchema)` | Set catalog base price. Body: `{ base_price: 0..10_000_000 }` |

## Customers

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/customers/me/profile` | Token, `roleGuard('admin','kunde')` | Own company profile (`kundenr/kundenavn/gruppe/valuta/lager/firma`). `kunde` gets own row |
| `GET` | `/customers` | Token, `roleGuard('admin')` | List all customers (paginated) |
| `GET` | `/customers/:kundenr` | Token, `roleGuard('admin')` | Single customer |

## Statistics

All statistics endpoints require `authMiddleware` and accept validated query parameters (`startDate`, `endDate`, `kundenr`, `varegruppe`, `page`, `limit`, plus `groupBy`/`metric`/`dimension` for time-series/custom). `kunde` users are automatically scoped to their own `kundenr`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/statistics/summary` | High-level dashboard KPIs (orders, revenue, avg, products) |
| `GET` | `/statistics/by-kunde` | Revenue / order count grouped by customer |
| `GET` | `/statistics/by-varegruppe` | Statistics grouped by product group |
| `GET` | `/statistics/by-vare` | Statistics grouped by individual product |
| `GET` | `/statistics/by-lager` | Statistics grouped by warehouse |
| `GET` | `/statistics/by-firma` | Statistics grouped by company |
| `GET` | `/statistics/time-series` | Orders over time (`groupBy=day/week/month/year`) |
| `GET` | `/statistics/custom` | Configurable metric (`sum/count/quantity`) + dimension (Advanced Analytics) |
| `GET` | `/statistics/batch` | Batch multiple stat queries in one call (dashboard optimisation) |

## Pricing

Read routes: `roleGuard('admin','analyse')` (customer-rules also allow `kunde`). Mutating routes: admin-only.

### Customer Groups

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/groups` | List all customer groups |
| `POST` | `/pricing/groups` | Create a customer group |
| `PUT` | `/pricing/groups/:id` | Update a customer group |
| `DELETE` | `/pricing/groups/:id` | Delete a customer group |
| `PUT` | `/pricing/groups/:id/customers/:kundenr` | Assign customer to group |
| `DELETE` | `/pricing/groups/customers/:kundenr` | Remove customer from group |
| `GET` | `/pricing/customers/search?q=` | Search customers for group assignment |
| `GET` | `/pricing/customers` | List customers with their groups |

### Price Lists

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/lists` | List all price lists |
| `GET` | `/pricing/lists/:id` | Get a single price list |
| `POST` | `/pricing/lists` | Create a price list |
| `PUT` | `/pricing/lists/:id` | Update a price list |
| `DELETE` | `/pricing/lists/:id` | Delete a price list |

### Price Rules

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/pricing/lists/:id/rules` | Get rules for a price list |
| `GET` | `/pricing/rules/:id` | Get a single rule |
| `POST` | `/pricing/rules` | Create a rule (`fixed_price` or `discount_percent`, scope vare/varegruppe/alle) |
| `PUT` | `/pricing/rules/:id` | Update a rule |
| `DELETE` | `/pricing/rules/:id` | Delete a rule |
| `POST` | `/pricing/rules/check-conflicts` | Check for rule conflicts before saving |

### Price Calculation & Simulation

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/pricing/calculate` | Calculate price for a single item |
| `POST` | `/pricing/calculate/bulk` | Calculate prices for multiple items |
| `GET` | `/pricing/customer/:kundenr/rules` | Get applicable rules for a customer (kunde may read own) |
| `POST` | `/pricing/simulate` | What-if simulation (admin only). Body validated by `simulateSchema`; returns KPI impact + comparison table |

Workflow: groups → lists → rules → assignment. See `PROGRAMLOGIKK.md` and the in-app `PricingGuide`.

## Dashboard (admin only)

All routes require `authMiddleware` + `roleGuard('admin')`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/dashboard/widgets` | All widget data in one call (top products/customers, deviations, data-status) |
| `GET` | `/dashboard/analytics` | Batch analytics for dashboards |
| `GET` | `/dashboard/top-products` | Top products widget |
| `GET` | `/dashboard/top-customers` | Top customers widget |
| `GET` | `/dashboard/price-deviations` | Price deviation alerts |
| `GET` | `/dashboard/data-status` | Data freshness status |

## Status & Observability (admin only unless noted)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/status` | admin | System status: `SELECT NOW(), version()` + row estimates (`ordre/kunde/vare/users`) |
| `GET` | `/status/import` | admin | Import status: `latestOrder { ordrenr, dato }`, `totalOrders`, `lastImport`, nominal message |
| `GET` | `/status/extraction` | admin | Extraction status: `{ status, lastExtraction, source: PostgreSQL, destination: API, healthy }` |
| `GET` | `/status/health` | admin | Frontend/backend health: backend `{ uptime, memory, nodeVersion }`, frontend `{ status, url }` (assumed healthy — see known limitation in `FUNKSJONER.md`) |
| `GET` | `/status/recent-activity?days=7` | admin | Data freshness: `MAX(dato)`, `daysSinceLastOrder`, totals, `fresh/stale` verdict |
| `GET` | `/status/api-metrics` | admin | API performance `{ summary, endpoints: [{ method, path, avgMs, minMs, maxMs, count, slowCount }] }` |
| `GET` | `/status/etl-metrics` | admin | ETL pipeline metrics (rows/sec, heap, streaming+bulk runs) |
| `GET` | `/health` | Public | Liveness probe `{ status: ok, timestamp }` |
| `GET` | `/health/ready` | Public | Readiness probe (checks `SELECT 1`) → `ready/not_ready + database` |
| `GET` | `/metrics` | Public (LAN only — never expose via Caddy) | Prometheus scrape endpoint |

## ETL / Database Management (admin only)

All ETL routes require `authMiddleware` + `roleGuard('admin')` + `etlLimiter`. Destructive routes additionally require `requireDestructiveEtl` (blocked in production unless `ENABLE_DESTRUCTIVE_ETL=true`). Upload limit 50 MB, only `.csv`/`.txt`.

| Method | Path | Destructive | Description |
|--------|------|-------------|-------------|
| `GET` | `/etl/createDB` | Yes | Create / recreate database tables |
| `GET` | `/etl/truncateDB` | Yes | Truncate all table data |
| `GET` | `/etl/generateTestData` | Yes | Generate test data in memory |
| `GET` | `/etl/insertTestData` | Yes | Insert generated test data |
| `GET` | `/etl/generateRealData` | Yes | Generate realistic data in memory |
| `GET` | `/etl/insertRealData` | Yes | Insert realistic data |
| `GET` | `/etl/runFullTestPipeline` | Yes | Full pipeline: truncate, create, generate, insert |
| `POST` | `/etl/generateBulkData` | Yes | Generate bulk data (millions of rows, validated by `bulkDataSchema`) |
| `GET` | `/etl/insertBulkData` | Yes | Insert bulk data via optimised COPY |
| `POST` | `/etl/runBulkPipeline` | Yes | Full bulk pipeline |
| `POST` | `/etl/runBulkPipelineStages` | Yes | Run staged bulk pipeline (`bulkStagesSchema`) |
| `POST` | `/etl/runBulkPipelineStreaming` | Yes | Streaming bulk pipeline (`bulkStreamingSchema`) |
| `POST` | `/etl/runBulkLoadFast` | Yes | Fast COPY load (fastest path for 100k+ rows) |
| `POST` | `/etl/upload-csv` | No | Upload CSV directly to a table via streaming COPY (`multipart/form-data`, field `file`) |
| `POST` | `/etl/ingest` | No | Unified ingest (`csv/json/api`, validated by `etlIngestSchema`) |
| `GET` | `/etl/tableCounts` | No | Fast row-count estimates for all tables |
| `GET` | `/etl/metrics` | No | ETL performance (streaming+bulk, heap, rows/sec; `?jobId=` filter) |
| `GET` | `/etl/benchmark?rows=100000` | No | Streaming benchmark (default 100k, max 2M) — returns rows/sec |
| `GET` | `/etl/jobs` | No | List recent ETL jobs |
| `GET` | `/etl/jobs/:jobId` | No | Single job status |
| `POST` | `/etl/jobs/:jobId/cancel` | No | Cancel a running job |
| `GET` | `/etl/jobs/:jobId/progress` | No | SSE stream for real-time job progress |

## Scheduler (admin only)

Timezone `Europe/Oslo`. Overlap guard returns `409` if a job is already running. Destructive jobs only run when `ENABLE_SCHEDULER_JOBS=true` (or outside production).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/scheduler/jobs` | List all scheduled jobs (`id, name, cronExpression, enabled, lastRun, status`) |
| `POST` | `/scheduler/jobs/:id/start` | Enable a job |
| `POST` | `/scheduler/jobs/:id/stop` | Disable a job |
| `POST` | `/scheduler/jobs/:id/run` | Run a job immediately |
| `GET` | `/scheduler/logs?jobId=&limit=` | View job execution logs (default 50, max 100 kept in memory) |
| `POST` | `/scheduler/jobs` | Create custom job — only predefined `taskType` allowed (`refresh-test-data`, `sync-real-data`, `purge-old-order-references`, `aggregate-stats`); otherwise stub |

Default jobs:

| ID | Cron | Task |
|----|------|------|
| `refresh-test-data` | `0 2 * * *` | `generateTestData + insertTestData` |
| `sync-real-data` | `0 */6 * * *` | `generateRealData + insertRealData` |
| `purge-old-order-references` | `0 3 * * 0` | Delete `ordre_henvisning` for orders older than 2 years |
| `aggregate-stats` | `0 * * * *` | `refreshStatisticsAggregates()` (always enabled) |

## Audit Log (admin only)

Append-only `audit_log` table (`CREATE|UPDATE|DELETE` with user, entity, changes, metadata, IP).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/audit?entity_type=&action=&user_id=&startDate=&endDate=&page=&limit=` | Paginated audit log (filterable) |
| `GET` | `/audit/:entityType/:entityId` | History for a specific entity |

## Notifications

All routes require `authMiddleware` (scoped to the caller).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/notifications?page=&limit=&unreadOnly=` | List notifications (deep-links to orders) |
| `GET` | `/notifications/unread-count` | Unread badge count |
| `POST` | `/notifications/mark-read` | Mark a set as read. Body: `{ ids: [...] }` |
| `POST` | `/notifications/mark-all-read` | Mark all as read |
| `POST` | `/notifications/:id/read` | Mark one as read |

## Assistant (AI help chat)

Server-side help about TESS (no live order data). Disabled unless `ENABLE_ASSISTANT=true`. Providers: Gemini Flash (default, cheaper) or OpenAI. Keys never reach the browser.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/assistant/status` | Token | Whether the assistant is enabled + provider/model info |
| `POST` | `/assistant/chat` | Token, `assistantLimiter` | Project help chat. Body: `{ messages: [...] }`. Rate-limited per user |

## Other Resources

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/suggestions/search?q=` | Token (rate-limited) | Autocomplete suggestions (orders/customers/products/users) |
| `GET` | `/reports` | Token | List saved reports/views |
| `POST` | `/reports` | Token | Save a report/view |
| `DELETE` | `/reports/:id` | Token | Delete a report/view |
| `POST` | `/client-events` | None (sendBeacon `text/plain`) | Unauthenticated browser telemetry (login-page crashes). Validated, logged only, never persisted. Max 100 events/call |
| `GET` | `/products/groups` | Token | Product groups (see Products) |

## Error Codes

| HTTP Status | Meaning | Typical cause |
|-------------|---------|---------------|
| `400` | Validation error | Bad input (Zod schema failure, bad CSV, missing fields) |
| `401` | Not authenticated | Missing/expired JWT, rotated refresh token, `tokenVersion` mismatch |
| `403` | Not authorised | Insufficient role (e.g. kunde calling admin endpoint) |
| `404` | Resource not found | Unknown `ordrenr/varekode/kundenr/user`, foreign kunde order (masked as 404) |
| `409` | Conflict | Illegal workflow transition, job already running, duplicate `idempotencyKey` race (returns existing order with `duplicate: true` instead where applicable) |
| `429` | Rate limit exceeded | See Rate limits above |
| `500` | Internal server error | Unhandled exception (check `x-request-id` + server logs) |
| `503` | Unavailable | Readiness probe DB disconnect, token-version cache DB failure (fail-closed) |

See also: `FUNKSJONER.md` (feature list per role), `PROGRAMLOGIKK.md` (business-logic deep dive), `ARCHITECTURE.md` (system design), `DEPLOY.md` (production ops).
