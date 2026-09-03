# TESS – Programlogikk

> Dyp forklaring av hvordan systemet faktisk virker. Målgruppe: utviklere som skal vedlikeholde eller bygge videre.
> Funksjonsliste: `FUNKSJONER.md`. API: `API.md`. Arkitektur: `ARCHITECTURE.md`. Drift: `DEPLOY.md`.
> Alle filreferanser er relative til repo-roten.

---

## 1. Prinsipper (hvorfor koden ser ut som den gjør)

1. **Tynne kontrollere, feite modeller.** `controllers/` orkestrerer HTTP (parse → kall → form respons). `models/` eier SQL. `services/` eier fler-stegs forretningsregler (ordreplassering, prising, aggregering).
2. **Fail-closed sikkerhet.** Ved tvil: nekt. Token-sjekk feiler til 503/401, ikke til åpen tilgang (`middleware/auth.ts`). Destruktiv ETL er av i produksjon uten eksplisitt flagg (`middleware/productionSafety.ts`).
3. **Server er sannhetskilde.** Klientpriser stoles aldri på; reprising skjer alltid server-side (`services/orderPlacementService.ts`). Workflow-overganger valideres mot en eksplisitt tilstandsmaskin (`lib/orderWorkflow.ts`).
4. **Idempotens der det koster.** Ordre-innsending har klientgenerert `idempotencyKey` — dobbeltklikk/retry lager aldri duplikat.
5. **Append-only sporbarhet.** `ordre_status_history` (tidslinje) og `audit_log` (alle entiteter) skrives, aldri oppdateres.
6. **To hastigheter for data.** `batchInsert` (multi-value INSERT, ~10k rader) og `bulkCopy` (PostgreSQL COPY-protokoll, 100k+ rader). Les mer i §7.

```
Klient → RateLimit → Metrics → Auth → RoleGuard → Zod → Controller → Service → Model → DB
                                                                                  ↓
                                                                            Audit + Varsler
```

---

## 2. Request-livssyklus (backend)

Plassering: `backend/src/index.ts:59-176`.

| Steg | Middleware | Hva skjer |
|------|-----------|-----------|
| 1 | `cors`, `helmet` | Låser origin til `FRONTEND_URL`, setter sikkerhetsheadere |
| 2 | `requestIdMiddleware` | Tildeler `x-request-id`, propageres til logger og feilsvar |
| 3 | `express.json({limit:'1mb'})` | Standard payload-grense. ETL-mount bruker `50mb` (`index.ts:158`) |
| 4 | `generalLimiter` | 1000 req / 15 min (skippet i dev) |
| 5 | `prometheusMiddleware` + `apiMetricsMiddleware` | Observerer latens per `method+path`, teller trege kall |
| 6 | Logging | `>=400` → warn, `>1000ms` → warn (slow request), ellers debug |
| 7 | `authMiddleware` | Validerer `Bearer` JWT, sjekker `token_version` mot DB (30 s cache). Fail-closed 503 ved DB-feil |
| 8 | `roleGuard(...)` | 401 uten token, 403 ved feil rolle |
| 9 | `validate(schema)` | Zod-sjekk av `body/query/params`. Feil → 400 |
| 10 | `asyncHandler` | Fanger avviste promises til `errorHandler` |
| 11 | Controller → Service → Model | Forretningslogikk + parametrisert SQL (`$1,$2…`) |
| 12 | `errorHandler` | Serialiserer `AppError`-hierarkiet til `{ status:'error', error }` med korrekt HTTP-kode |

Spesialruter uten auth (med vilje): `GET /health`, `GET /health/ready`, `GET /metrics` (kun LAN — Caddy må aldri eksponere den), `POST /client-events` (telemetri, kun logging, ingen persistens).

---

## 3. Autentisering og autorisasjon

Filer: `middleware/auth.ts`, `controllers/authController.ts`, `models/userModel.ts`, `models/refreshTokenModel.ts`, `lib/jwt.ts`, `lib/password.ts`.

### 3.1 Innlogging

- **Admin/analyse:** `POST /auth/login` med `{ username, password }` → `findByUsername` + bcrypt-sammenligning + dummy-hash ved ukjent bruker (motvirker enumeration).
- **Kunde:** `POST /auth/login-kunde` med `{ kundenr, password }` → `findByKundenr` + bcrypt. `kundenr` er både brukernavn og relasjon til `kunde`-tabellen.
- Svar: `{ token (JWT 1t), refreshToken (ugjennomsiktig 64 tegn), user { id, username, role, kundenr? } }`.
- JWT-claims: `{ id, username, role, kundenr?, tokenVersion }` (`jwtClaimsFromUser`).

### 3.2 Refresh-rotasjon

`POST /auth/refresh { refreshToken }` → valider hash i `refresh_tokens` → **forbruk** gammelt token → utsted nytt par. Gjenbruk feiler med 401 (tyverideteksjon). Gyldighet 7 dager, SHA-256-lagret.

### 3.3 Passordbytte dreper sesjoner

`POST /auth/change-password { currentPassword, newPassword(min 8) }` → `hashPassword` (bcrypt) → `bumpTokenVersion` + `invalidateTokenVersionCache` + `revokeAllForUser`. Alle utstedte access-tokens blir ugyldige fordi `tokenVersion`-claim ikke lenger matcher DB.

### 3.4 Autorisasjon (roller + radfiltrering)

```ts
roleGuard('admin')                    // kun admin
roleGuard('kunde','admin')            // bestilling, kansellering
roleGuard('admin','analyse')          // prislesing
roleGuard('admin','kunde')            // egen profil
roleGuard('kunde','admin','analyse')  // katalog
```

**Radfiltrering:** kundemodeller legger til `WHERE kundenr = $n` fra `req.user.kundenr` (`http/ownership.ts:resolveOrderKundenr()`). Admin kan sende `kundenr` i body/query for å handle på vegne av kunde; kunde kan ikke overstyre. Fremmede ordrer maskeres som **404**, ikke 403 (unngår probing).

Frontend speiler dette: `ProtectedRoute allowedRoles`, `navConfig.tsx` (ulike menyer), `Layout.tsx` (søk/varsler kun admin+kunde).

---

## 4. Ordre-domenet (kjernelogikken)

### 4.1 Skjema (forenklet ER)

```
kunde(kundenr PK, kundenavn, customer_group_id FK)
firma(firmaid PK, firmanavn)
lager(lagernavn, firmaid) PK(lagernavn,firmaid) FK→firma
vare(varekode PK, varenavn, varegruppe, base_price DECIMAL)
valuta(valutaid PK)

ordre(ordrenr PK, dato, kundenr FK, kundeordreref, kunderef,
      firmaid FK, lagernavn (+firmaid FK), valutaid FK,
      sum DECIMAL(12,2), workflow_status, status_updated_at, idempotency_key UNIQUE)

ordrelinje(ordrenr FK, linjenr, varekode FK, antall DECIMAL(12,3),
           enhet, nettpris, linjesum, linjestatus) PK(ordrenr,linjenr)

ordre_henvisning(ordrenr, linjenr, henvisning1..5) PK(ordrenr,linjenr) FK→ordrelinje
ordre_status_history(id, ordrenr FK, fra, til, bruker, kommentar(≤500), tidspunkt)
```

Full DDL: `init.sql:26-106` + trigram-indekser `:274-278` + ytelsesindekser. Migrasjoner: `backend/src/db/migrations/001-012` (prising, statistikk-indekser, audit, trigram, materialized views, ETL-progress, workflow+varsler, kundebestilling, refresh-tokens, penger-desimal, sum-backfill, statushistorikk).

### 4.2 Ordreplassering (kritisk sti)

Fil: `services/orderPlacementService.ts:1-189`. Kalles fra `POST /orders` (`controllers/orderController.ts:create`).

```
1. Idempotens-sjekk: SELECT ordrenr FROM ordre WHERE idempotency_key=$1
   → treff? returner { duplicate:true } (200, ingen ny rad)
2. Valider produkter mot vare (404 ved ukjent varekode)
3. Server-reprising: pricingService per linje (klientpris ignoreres)
4. Transaksjon (atomisk):
   a. ordrenr fra sekvens (egen sekvens for kundeordrer)
   b. INSERT ordre (status=pending_approval)
   c. INSERT ordrelinjer (linjenr 1..N)
   d. UPDATE ordre.sum = Σ linjesum
   race på idempotency_key (23505)? → hydrate() eksisterende ordre
5. publishOrderSubmitted() → audit-rad + admin-varsel
```

Regler: `items` 1–200, ingen duplikat `varekode` (`superRefine`), `antall >0 ≤1M`, `valutaid` default NOK, `idempotencyKey` 8–64 `[A-Za-z0-9_-]`. Rate-limit 60/t (200 dev) per bruker.

### 4.3 Workflow-tilstandsmaskin

Fil: `lib/orderWorkflow.ts:1-77`. Norske labeler i `ORDER_WORKFLOW_LABELS`.

```
new ──→ processing ──→ shipped ──→ invoiced
 │         │              │
 │         └──→ cancelled ←┘
 │
pending_approval ──→ approved ──→ processing …
 │        │──→ rejected (terminal)
 │        └──→ cancelled
 └──→ cancelled
```

- `ORDER_WORKFLOW_TRANSITIONS` er uttømmende; `canTransition(fra,til)` håndheves server-side. Ulovlig → **409**.
- `KUNDE_CANCELLABLE_STATUSES = [pending_approval, approved]` — etter `processing` kreves admin.
- `ORDER_WORKFLOW_TERMINAL_STATUSES = [invoiced, cancelled, rejected]` — ekskluderes fra «aktive ordre» (`SQL_ACTIVE_ORDER_WHERE`).
- Hver overgang skriver `ordre_status_history` via `transitionWithHistory()` (hvem/når/fra→til/kommentar) + `audit_log`-rad. `PATCH /orders/:ordrenr/status` krever kommentar ved avvisning (≤500 tegn). Samtidige flyttinger detekteres (409).
- Bulk i admin-UI: `frontend/src/lib/bulkTransitions.ts` (`partitionByLegalTransition`, `executeBulkStatusUpdate`) — deler utvalget i lovlige/ulovlige før kall.

### 4.4 Ordrelinje-CRUD

Filer: `controllers/orderLineController.ts`, `models/orderLineModel.ts`. Alle muterende kall er admin-only.

- `POST /orderlines` / `PUT /orderlines/:ordrenr/:linjenr` valideres av `orderLineSchema` (`antall>0`, `nettpris≥0`, `linjestatus 0-10`). `ordrelinje.linjesum = antall × nettpris` beregnes server-side.
- `ordre.sum` rekalkuleres i **samme transaksjon** som linje-endringen — ingen «hengende summer».
- `PUT .../references` upserter `henvisning1..5` (oppretter rad hvis den mangler).
- `DELETE` returnerer `{ message, deleted }` og skriver audit.

### 4.5 Søk, sortering, paginering

- `GET /orders` valideres av `orderQuerySchema` (`pagination + dateRange + sort + kundenr/ordrenr/firmaid/lagernavn/kundeordreref/kunderef/search/q/workflowStatus`).
- Fritekst `search/q` treffer `kundenr/kundenavn/henvisninger/referanser` via trigram-indekser (`004_trigram_search_indexes.sql`) + `LIKE`/similarity-rangering.
- `GET /orders/search/references?q=` søker isolert i `ordre_henvisning` (må registreres før `/:ordrenr`-ruta).
- Sortering: admin sender `sortBy/sortDir` til server; kunde sorterer klient-side (kjent begrensning, se `FUNKSJONER.md §6`).
- Paginering: ordre 50/side, statistikk 25, brukere 20, varsler 20. Svar: `{ data, pagination: { page, limit, total } }`.

---

## 5. Prisingsmotoren

Filer: `services/pricingService.ts`, `services/pricingMath.ts`, `services/pricingSimulatorService.ts`, `models/pricing/*`, `controllers/pricing/*`.

### 5.1 Hierarki

```
customer_group (f.eks. Grossist, VIP)
   └─ price_list (prioritet + gyldighetsperiode + aktiv-flagg)
        └─ price_rule (scope: vare | varegruppe | alle;
                       type: fixed_price | discount_percent;
                       produktfilter + kundegruppefilter + datovindu)
kundenr → customer_group (tildeling)
```

Oppsett-rekkefølge (håndheves i UI-guiden `PricingGuide.tsx`): **grupper → lister → regler → tildeling**. Uten tildeling får kunden base-pris.

### 5.2 Kalkyle (`calculate`)

`POST /pricing/calculate { kundenr, varekode, antall?, dato? }`:

1. Hent `base_price` fra `vare`.
2. Hent alle aktive regler for kundens gruppe + datovindu.
3. Ranger etter **prioritet, spesifisitet (vare > varegruppe > alle), dato**.
4. Første treff vinner; `fixed_price` erstatter, `discount_percent` multipliserer.
5. Returner `{ basePrice, effectivePrice, appliedRuleId?, explanation }`.

`POST /pricing/calculate/bulk` gjør samme i batch (katalog + ordrehode). `GET /pricing/customer/:kundenr/rules` viser hvilke regler som traff (kunde kan lese egne — brukes i «Mine priser»).

### 5.3 Konflikter og simulering

- `POST /pricing/rules/check-conflicts` (admin): detekterer overlappende regler (samme scope + overlappende dato + ulik pris) før lagring.
- `POST /pricing/simulate` (admin, `simulateSchema`): hva-hvis-kjøring over historiske linjer — returnerer KPI-effekt (omsetning/margin/volum) + sammenligningstabell. Skriver aldri til DB.
- `PATCH /products/:varekode/price { base_price }` (admin): setter katalogpris som rabattene regnes fra. Valideres `0..10M`.

### 5.4 Katalog vs master

- `/catalog/products` = kundevendt visning med **effektive priser** (prismotor kjørt). Rate-limitet (søk).
- `/products` = masterdata (base-priser, grupper). Admin redigerer her.

---

## 6. Statistikk og analyse

Filer: `controllers/statisticsController.ts`, `models/statistics/{grouped,timeSeries,customStats,top,types,pagination}.ts`, `services/statsAggregateService.ts`.

| Endepunkt | Spørring | Bruk |
|-----------|---------|------|
| `by-kunde/varegruppe/vare/lager/firma` | `GROUP BY` + `SUM(linjesum)`, `COUNT(DISTINCT ordrenr)`, `SUM(antall)` + filtre (`startDate/endDate/kundenr/varegruppe`) | Stolpe/linje/kake + tabell |
| `time-series` | date-trunc (`day/week/month/year`) + `fillMissingPeriods` (null-dager → 0) | Trendgrafer |
| `summary` | Aggregerte KPI-er | Dashboard-kort |
| `custom` | `metric (sum/count/quantity)` × `dimension` | Avansert analyse |
| `batch` | Flere spørringer i ett kall | Dashboard (1 round-trip) |

- **Kunde-scoping:** `kunde`-rollen får automatisk `WHERE kundenr = <egen>` injisert — samme motor, ulik radmengde.
- **Sammenligning:** frontend beregner forrige periode (`getPreviousRange`) og viser delta i `StatsKpiStrip`.
- **Drill-down:** `varegruppe → vare`, `kunde(kundenr) → vare` (`StatsTable` rad-klikk).
- **Ytelse:** `002_statistics_indexes.sql` + `005_stats_materialized_views.sql` (oppfriskes av scheduler-jobben `aggregate-stats` hvert minutt) + `batch` for å unngå N+1.
- **Eksport:** `ExportButton` (html2canvas skala 2 → jsPDF) for grafer; `fetchAllStatRows + buildStatsExportRows` paginerer gjennom alle sider for full CSV (ikke kun synlig side).

---

## 7. ETL, import og scheduler

### 7.1 ETL-arkitektur

Filer: `etl/{etlQueue,etlJobStore,jobRegistry,etlMetrics,checkpoint,bulkLock,copyBufferEncoder,deadLetter,etlFailures,etlBenchmark}.ts`, `controllers/etl/*.ts`, `db/{copyLoaders,batchInsert,copy/*}.ts`, `lib/etlProgress.ts`.

```
CSV/opplasting ─→ multer (50 MB, .csv/.txt) ─→ validering (etlIngestSchema)
   ├─ små volum → batchInsert (multi-value INSERT)
   └─ store volum → bulkCopy (pg-copy-streams, COPY FROM STDIN)
        → checkpoint (gjenopptak) → deadLetter (feilede rader) → metrics
Jobb-sporing: etlJobStore + jobRegistry → GET /etl/jobs/:jobId + SSE /progress
```

- **Ruter:** se `API.md §ETL`. Les-ruter (`tableCounts/metrics/benchmark/jobs`) er alltid åpne for admin; skriv/destruktive krever `requireDestructiveEtl`.
- **Produksjonssperre:** `isDestructiveEtlEnabled()` = `ENABLE_DESTRUCTIVE_ETL=true`. Uten den svarer destruktive ruter 403. Samme mønster for scheduler (`isSchedulerJobsEnabled`).
- **Kø:** `etlQueue` serialiserer tunge jobber (unngår samtidige COPY som dreper poolen). `bulkLock` hindrer overlapp. `cancelJob` aborterer pipeline og markerer `cancelled`.
- **Faktatabell-integritet:** `ensureFactTableIntegrity()` kjøres ved oppstart (healer FK/indekser etter krasjet bulk-kjøring).
- **Frontend:** `pages/admin/ETL.tsx` (4 faner) + `useEtlJobs` (polling/SSE) + `useEtlJobToasts` (fullført/feilet-toast kun admin).

### 7.2 Scheduler

Fil: `scheduler/index.ts`. Tidssone `Europe/Oslo`, overlap-guard (hopper tick hvis `status=running`, logger `skipped`), 409 ved manuell kjøring av løpende jobb.

| Jobb | Cron | Oppgave |
|------|------|---------|
| `refresh-test-data` | `0 2 * * *` | Testdata-regenerering (kun når destruktive jobber er på) |
| `sync-real-data` | `0 */6 * * *` | Realistisk data-synk (kun destruktiv-modus) |
| `purge-old-order-references` | `0 3 * * 0` | Sletter `ordre_henvisning` for ordre >2 år (faktarader beholdes med vilje) |
| `aggregate-stats` | `0 * * * *` | `refreshStatisticsAggregates()` (alltid på) |

Logger holdes i minne (siste 100): `GET /scheduler/logs?jobId=&limit=`.

### 7.3 Status og observability

- `models/statusModel.ts`: `getSystemStatus` (`NOW()+version()` + estimater via `lib/tableEstimate.ts`), `getImportStatus` (siste ordre + total), `getExtractionStatus` (statisk nominal + kilde/mål), `getHealth` (uptime/minne/node + frontend-URL), `getRecentActivity(days≤90)` (fersk/stal-dom).
- `middleware/apiMetrics.ts`: per-endepunkt `avg/min/max/count/slowCount`.
- `metrics/prometheus.ts`: `/metrics` (െന്ന് internt).
- `POST /client-events`: anonym telemetri (kun `logger.warn`, ingen DB) — brukes til login-side-krasj.

---

## 8. Varsler, revisjon og hjelpesystemer

- **Varsler** (`services/notificationService.ts`, `services/alertDelivery.ts`): `publishOrderSubmitted` oppretter admin-varsel ved ny bestilling; statusendringer varsler kunde. `notification_reads` sporer lest/ulest. Frontend: `NotificationBell/Watcher`, lyd (`notificationSound.ts`), deep-link (`notificationNavigation.ts:buildDeepLink` → ordre).
- **Revisjon** (`services/auditService.ts`, `migrations/003`): `audit_log(id,timestamp,user_id,username,action,entity_type,entity_id,entity_name,changes,metadata,ip)`. Skrives ved ordre-, linje-, pris-, bruker- og ETL-hendelser. Aldri oppdatert/slettet via API.
- **Lagrede visninger** (`models/reportModel.ts`, `reportsRouter`): filtre + sortering + kolonner per scope (`kunde-orders`, `admin-orders`, `*-statistics`, `*-advanced-analytics`). Admin-visninger kan deles.
- **Assistent** (`assistant/{chatService,validation,config,safety/*}`, `knowledge/chunks.ts` 13 kuraterte chunks): svarer kun om systemet, aldri livedata. Rate-limitet per bruker. Av som standard i prod.
- **Katalogtjeneste** (`services/catalogService.ts`): slår sammen `vare` + effektive priser + lager/firma-tilgjengelighet for bestillings-UI.

---

## 9. Frontend-programlogikk (der feil oftest oppstår)

- **State:** server-state i TanStack Query (nøkler `['domain','resource',...params]`, `staleTime 5 min`, `retry 1`, ingen refetch-på-fokus). Klient-state i Context (`AuthContext`, `CartProvider` maks 200 linjer).
- **API-lag:** `lib/api/*.ts` (ett fil per domene) via felles `client.ts` (axios + single-flight refresh-interceptor). Barrel-eksport i `lib/api/index.ts`.
- **Tabeller:** `DataTable.tsx` (sort asc/desc, `serverSort/disableClientSort`, kolonnevelger med `storageKey`, CSV via `lib/csv.ts`). Admin-tabeller sender `sortBy/sortDir`; kunde-tabeller sorterer klient-side.
- **Statistikk-sider:** `StatisticsPage.tsx` + `StatsFilters/Charts/Table/KpiStrip/PresetChips` + `statisticsPresets.ts`. Avansert: `AdvancedAnalyticsPage.tsx` + `analyticsPresets.ts`.
- **Bestilling:** `useCatalogBrowse` (søk+gruppe) → `CartProvider` → `useOrderSubmission` (genererer `idempotencyKey`, håndterer `duplicate:true`) → `ConfirmOrderModal`.
- **Ruting:** `App.tsx` lazy-laster alle sider (`Suspense` + `PageLoader`), `ProtectedLayout` per rolle-gruppe, `RouteErrorBoundary` per tre. Prefetch på nav-hover (`lib/prefetch.ts`).
- **Navigasjon:** `navConfig.tsx` er sannhetskilde (sidebar + mobil bunnmeny deler objekter — kan ikke drive). `isNavItemActive` bruker lengste match (nøstede ruter forblir markert).
- **Feilhåndtering:** `apiErrors.ts` (global toast), `QueryErrorBanner`, `QueryRefetchBar`, `reportError` (client-events). Ingen rå `fetch` — alt via `client.ts`.

---

## 10. Teknisk gjeld og anbefalte neste steg

| # | Gjeld | Konsekvens | Anbefalt tiltak |
|---|-------|-----------|-----------------|
| 1 | Kunde-sortering er klient-side | Feil inntrykk av «alle kolonner» ved >50 rader | Send `sortBy/sortDir` også for kunde (1-linjers endring + test) |
| 2 | Frontend-helse er antatt | Falsk trygghet i statusbildet | Aktiv probe (fetch `FRONTEND_URL`) eller RUM via `/client-events` |
| 3 | Ingen OpenAPI-generator | `API.md` kan drive fra `routes/` | Generer OpenAPI fra Zod-skjemaer + kontraktstest i CI |
| 4 | `POST /scheduler/jobs` er stub | Forvirrende API | Fullfør eller fjern; dokumenter som stub inntil videre (gjort i `API.md`) |
| 5 | ` ordre_henvisning`-søk er fritekst | Ingen H1–H5-separasjon i UI | Avansert-filter ved behov (backend støtter det allerede) |
| 6 | Miks av norsk/engelsk i kode | Liten friksjon for nye utviklere | Hold norsk i UI + `*_LABELS`, engelsk i API/kode (nå dokumentert) |

---

## 11. Hvordan verifisere endringer (kjøreplan)

```bash
# Backend
cd backend
npm run lint
npm test
npm run test:integration   # krever test-DB

# Frontend
cd frontend
npm run lint
npm run test               # vitest
npm run build              # tsc + vite

# Full stack (manuell)
docker compose up --build
# Frontend http://localhost:3000, API http://localhost:5000, DB 5432
# Logg inn som admin/analyse/K001, sjekk /hjelp NO/EN, statistikk-eksport, ETL-jobb + SSE
```

Miljøflagg som styrer logikk: `ENABLE_ASSISTANT`, `ASSISTANT_PROVIDER`, `GEMINI_API_KEY`/`OPENAI_API_KEY`, `ENABLE_DESTRUCTIVE_ETL`, `ENABLE_SCHEDULER_JOBS`, `ADMIN_PASSWORD` (bootstrap), `JWT_SECRET`, `DATABASE_URL`, `FRONTEND_URL`/`VITE_API_URL`, `VITE_SUPPORT_EMAIL`, `VITE_APP_ENV`.

Se `DEPLOY.md` for prod-rutiner (backup `pg_dump -Fc`, retention 7d, Caddy, `/health`-prober).
