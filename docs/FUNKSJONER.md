# TESS – Funksjonsoversikt

> Norsk funksjonsliste per rolle. Teknisk API-referanse: `API.md`. Programlogikk: `PROGRAMLOGIKK.md`. Arkitektur: `ARCHITECTURE.md`. Drift: `DEPLOY.md`.
> In-app hjelp: `/hjelp` (norsk standard, engelsk via knapp).

Demobrukere (dev): `admin / admin123` (administrator), `analyse / analyse123` (analyse), `K001 / kunde123` (kunde).

---

## 1. Kravdekning – opprinnelig kravliste

### 1.1 Analyse-bruker

| # | Krav (opprinnelig tekst) | Status | Løsning |
|---|--------------------------|--------|---------|
| A1 | Eksportere PDF eller bildefil med statistikk for salgsordre | ✅ Dekket | `ExportButton` (jsPDF + html2canvas, PNG/PDF) på dashboard, statistikk og avansert analyse |
| A1.1 | Statistikk salgsordre mot lager visualisert | ✅ Dekket | `GET /statistics/by-lager`, `STAT_TYPES: lager`, stolpe/linje/kake |
| A1.2 | Statistikk mot firma visualisert | ✅ Dekket | `GET /statistics/by-firma` |
| A1.3 | Statistikk mot kunde visualisert | ✅ Dekket | `GET /statistics/by-kunde` + topp-10 kunder på dashboard |
| A1.4 | Statistikk mot varer visualisert | ✅ Dekket | `GET /statistics/by-vare` |
| A1.5 | Statistikk mot varegrupper visualisert | ✅ Dekket | `GET /statistics/by-varegruppe` (MVP-kjerne) |
| A2 | Velge fritt hva som skal med i statistikken | ✅ Dekket | `GET /statistics/custom` (mål × dimensjon), `AdvancedAnalyticsPage`, lagrede visninger, kolonnevelger, CSV-eksport av alle rader |
| A3 | Bestemme tidsrom for datagrunnlag | ✅ Dekket | `startDate/endDate` + hurtigvalg 7/30/90 dager / i år + forrige-periode-sammenligning |
| A-NF1 | Eksport skjer hurtig | ✅ Dekket | Paginering (25/side), `batch`-endepunkt, materialized views, `fetchAllStatRows` i bakgrunn |
| A-NF2 | Brukervennlig, ikke overveldende | ✅ Dekket | Rolestyrte menyer (analyse ser kun 2 sider), onboarding, `StatsPresetChips`, norsk UI |
| A-NF3 | Stole på dataens integritet | ✅ Dekket | Statusside + ferskhet (`recent-activity`), audit-logg, parametrisert SQL, transaksjoner |
| A-NF4 | Dokumentasjon av funksjoner | ✅ Dekket (nå) | Denne filen + `/hjelp` + `PROGRAMLOGIKK.md` |

### 1.2 Kunde-bruker

| # | Krav | Status | Løsning |
|---|------|--------|---------|
| K1 | Søke opp salgsordre via variabler | ✅ Dekket | Fritekst + strukturerte filtre, autocomplete (min 3 tegn), `GET /orders`, `GET /orders/search/references`, `GET /suggestions/search` |
| K1.1 | Søk via ordrenr | ✅ Dekket | Eget ordrenr-felt + deep-link `/kunde/orders/:ordrenr` + Ctrl+K |
| K1.2 | Søk via kundenr | ✅ Dekket (admin) / begrenset (kunde) | Fritekstfelt søker `kundenr/kundenavn`. Kunde ser kun egne ordrer av sikkerhetshensyn (radfiltrering) — korrekt oppførsel |
| K1.3 | Søk via andre variabler, f.eks. dato | ✅ Dekket | Fra/til-dato + ordrestatus (`workflowStatus`) + firma/lager |
| K1.4 | Søk via henvisning 1–5 | ✅ Dekket | `ordre_henvisning(henvisning1..5)` på linjenivå + trigram-indekser + `GET /orders/search/references`. UI: fritekstsøk treffer henvisninger; ordredetalj viser dem per linje |
| K2 | Sortere tabell med salgsordre på alle kolonner | ⚠️ Delvis | Kolonneheader-sortering finnes. Admin = server-sortering (alle sider). Kunde = klient-sortering (gjeldende side, 50 rader). Kjent begrensning, se §6 |
| K-NF3 | Siden er hurtig | ✅ Dekket | Prefetch på hover, React Query-cache 5 min, paginering, `COPY`-import, indekser |
| K-NF4 | Enkel, ikke overveldende | ✅ Dekket | 8 kunde-sider maks, mobil bunnmeny, onboarding-modal, tom-tilstander |
| K-NF5 | Dokumentasjon av funksjoner | ✅ Dekket (nå) | `/hjelp` + denne filen |

### 1.3 Administrator-bruker

| # | Krav | Status | Løsning |
|---|------|--------|---------|
| AD1 | Ettersjekke at datagrunnlaget blir oppdatert | ✅ Dekket | `/admin/status`: system, `recent-activity` (fersk/stal), `data-status`-widget, `api-metrics`, `etl-metrics` |
| AD2 | Slette linjer | ✅ Dekket | `DELETE /orderlines/:ordrenr/:linjenr` + `ConfirmModal`, sum rekalkuleres |
| AD3 | Endre linjer | ✅ Dekket | `PUT /orderlines/:ordrenr/:linjenr` + produktsøk (debounce 300 ms) |
| AD4 | Legge til linjer | ✅ Dekket | `POST /orderlines` + `FormModal` |
| AD5 | Statusside for uttrekk fra DB | ✅ Dekket | `GET /status/extraction` + ETL-jobbpanel + SSE-progress |
| AD6 | Statusside for import til DB | ✅ Dekket | `GET /status/import` + `upload-csv`/`ingest` + `tableCounts` + jobb-logg |
| AD7 | Statusside for frontend og backend | ⚠️ Delvis | `GET /status/health` viser backend (uptime/minne/node) + frontend som «assumed healthy». Ingen reell frontend-probe — kjent begrensning, se §6 |
| AD-NF8 | Nok dokumentasjon for videreutvikling | ✅ Dekket (nå) | `ARCHITECTURE.md` + `PROGRAMLOGIKK.md` + denne filen + `API.md` |
| AD-NF9 | Alle funksjoner listet og forklart | ✅ Dekket (nå) | Denne filen |
| AD-NF10 | Forklaring av programlogikk | ✅ Dekket (nå) | `PROGRAMLOGIKK.md` |

### 1.4 MVP-avklaring

- **MVP = kunde + varegruppe:** oppfylt og overoppfylt. Kundeordre-flyten og `by-varegruppe` var kjernen; i tillegg leveres lager/firma/kunde/vare-statistikk.
- **Kunde-scope (analyse + salgsordre-bruker + dokumentasjon + login):** oppfylt.
- **Admin-scope (analyse + salgsordre-admin + vare + status + dokumentasjon + login):** oppfylt.
- **Enkel login med kundenr + passord:** oppfylt via `POST /auth/login-kunde`. Admin/analyse logger inn med brukernavn via `POST /auth/login`.

---

## 2. Funksjoner per rolle

### 2.1 Kunde (`/kunde/*`, roller: `kunde`, `admin`)

| Side | Rute | Hva du kan gjøre | API |
|------|------|------------------|-----|
| Dashboard | `/kunde` | Se nøkkeltall (ordre/omsetning/produkter/snitt), sparkline, linje/kake-diagram, siste 5 ordrer, snarveier. Eksporter dashboard som PDF/PNG | `GET /statistics/summary`, `GET /statistics/batch`, `GET /orders?page=1&limit=5` |
| Ordrer | `/kunde/orders` | Fritekst (kundenr/henvisning/ref/kunde, min 3 tegn), ordrenr-felt, fra/til-dato, statusfilter, klient-sortering, kolonnevelger, CSV-eksport av siden, lagrede visninger, mobilkort, filter-chips | `GET /orders`, `GET /orders/search/references`, `GET /suggestions/search` |
| Ordredetalj | `/kunde/orders/:ordrenr` | Tidslinje, statusmerke, linjesammendrag, last ned PDF/CSV, bestill igjen, kanseller (hvis `pending_approval`/`approved`), historikk | `GET /orders/:ordrenr`, `GET /orders/:ordrenr/history`, `PATCH /orders/:ordrenr/cancel` |
| Ny bestilling | `/kunde/order/new` | Søk `varekode/varenavn` + `varegruppe`, handlekurv (maks 200 linjer) med live kundepris, bekreftelsesmodal, idempotent innsending | `GET /catalog/products`, `POST /orders` |
| Mine priser | `/kunde/pricing` | Read-only prisliste: søk + filter på prislistenavn, `fastpris/rabatt-%`, omfang (vare/varegruppe/alle) | `GET /pricing/customer/:kundenr/rules` |
| Statistikk | `/kunde/statistics` | Samme motor som analyse (lager/firma/kunde/vare/varegruppe), tidsrom, drill-down (varegruppe→vare, kunde→vare), KPI-stripe, eksport PDF/PNG/CSV | `GET /statistics/*` |
| Avansert analyse | `/kunde/analytics` | Mål (`sum/count/quantity`) × dimensjon (`day/month/year/product/category`), graf (`bar/line/pie`), paginerte detaljer | `GET /statistics/custom`, `GET /statistics/time-series` |
| Varsler | `/kunde/varsler` | Alle/uleste + typefilter, lyd, deep-link til ordre, relativ tid (nb-NO) | `GET /notifications`, `POST /notifications/*` |
| Min konto | `/kunde/konto` | Firmaprofil (`kundenr/navn/gruppe/valuta/lager/firma`), handelsoversikt | `GET /customers/me/profile` |
| Innstillinger | `/kunde/settings` | Bytt passord, se hjem-side per rolle | `POST /auth/change-password` |

Global kunde-funksjonalitet: **Ctrl+K-søk** (ordre/kunde/produkt), **klokke/varsler**, **mobilmeny**, **onboarding-modal** (5 steg, `localStorage`), **AI-hjelp** (valgfri).

### 2.2 Analyse (`/analyse/*`, roller: `analyse`, `admin`)

| Side | Rute | Hva du kan gjøre | API |
|------|------|------------------|-----|
| Dashboard | `/analyse` | Sammendrag + topp-10 kunder + varegruppe + tidsserie, eksport PDF/PNG | `GET /statistics/batch`, `GET /statistics/summary` |
| Statistikk | `/analyse/statistics` | Full statistikk-motor (se kunde-statistikk), lagrede visninger (private) | `GET /statistics/*` |
| Innstillinger | `/analyse/settings` | Bytt passord | `POST /auth/change-password` |

Analyse har bevisst **ingen** ordre-søk, bestilling, prisstyring eller ETL — lesetilgang til statistikk.

### 2.3 Administrator (`/admin/*`, rolle: `admin`)

| Side | Rute | Hva du kan gjøre | API |
|------|------|------------------|-----|
| Dashboard | `/admin` | Alle nøkkeltall, firma/lager-stats, topp produkter/kunder, prisavvik, dataferskhet, ordre som trenger oppmerksomhet (mangler `kunderef`), godkjenningskø-teller, eksport | `GET /dashboard/widgets`, `GET /dashboard/analytics`, `GET /status/*` |
| Ordrekø | `/admin/approvals` | Faner (`pending_approval/new/approved/processing`), bulk-velg per `ordrenr`, lovlige overganger (`canTransition`), kommentarplikt ved avvisning, deep-link til ordredetalj | `PATCH /orders/:ordrenr/status` |
| Ordrer | `/admin/orders` | Samme søk som kunde **+ server-sortering** (`sortBy/sortDir`), delte lagrede visninger | `GET /orders` |
| Ordredetalj | `/admin/orders/:ordrenr` | Status-dropdown med overgangsregler + kommentar, tidslinje, PDF, bestill-igjen, historikk | `GET /orders/:ordrenr`, `PATCH /orders/:ordrenr/status` |
| Ordrelinjer | `/admin/orderlines` | Velg blant 100 siste ordrer, tabell med CSV-eksport, **legg til/endre/slett linje** (`varekode/antall/enhet/nettpris/linjestatus`), produktsøk, henvisning 1–5 per linje | `GET /orderlines/order/:ordrenr`, `POST /orderlines`, `PUT /orderlines/:ordrenr/:linjenr`, `DELETE ...`, `PUT .../references` |
| Statistikk | `/admin/statistics` | Full motor + delte visninger | `GET /statistics/*` |
| Avansert analyse | `/admin/analytics` | Full motor + delte presets | `GET /statistics/custom` |
| Prisstyring | `/admin/pricing` | Faner: grupper/lister/regler/kunder/forhåndsvisning/simulator/audit-logg + 4-stegs guide (grupper→lister→regler→tildeling), konflikt-sjekk, hva-hvis-simulering | `GET/POST/PUT/DELETE /pricing/groups|lists|rules`, `POST /pricing/simulate`, `POST /pricing/calculate` |
| Kunder | `/admin/customers` | Søk + gruppefilter, server-sortering, CSV, URL-synk, ordre-modal per kunde (ordrenr + dato + paginering) | `GET /customers`, `GET /customers/:kundenr` |
| Produkter | `/admin/products` | Søk (`varekode/varenavn`) + gruppefilter, server-sortering, CSV, **inline base-pris-edit** | `GET /products`, `PATCH /products/:varekode/price` |
| Brukere | `/admin/users` | Tabell (`id/username/role/kundenr/created`), opprett/rediger (`username/password/role/kundenr`), slett, action-key-modal | `GET/POST/PUT/DELETE /users`, `GET /users/search` |
| Status | `/admin/status` | System/import/scheduler-kort, API-metrikk-tabell (sorterbar), nylig aktivitet, auto-refresh 30 s | `GET /status/*`, `GET /scheduler/*` |
| ETL/Data | `/admin/etl` | Faner: handlinger/bulk/jobber/scheduler. Kjør pipelines, bulk-generering (millioner rader), CSV-opplasting (streaming COPY), `tableCounts`, jobb-liste + SSE-progress + cancel | `GET/POST /etl/*` |
| Endringslogg | `/admin/audit` | Filter (`entity/action/user/dato`), snapshot-diff med norske feltlabeler, CSV-eksport | `GET /audit`, `GET /audit/:entityType/:entityId` |
| Varsler | `/admin/varsler` | Samme som kunde, scopet til admin | `GET /notifications` |
| Innstillinger | `/admin/settings` | Bytt passord, miljøinfo | `POST /auth/change-password` |

### 2.4 Felles / tverrgående

| Funksjon | Hvor | Merknad |
|----------|------|---------|
| Login | `/login` | Modus `standard` (admin/analyse) og `kunde` (kundenr). Auto-redirect per rolle. «Kontakt support»-lenke |
| Hjelp | `/hjelp` | NO standard + EN-knapp, søk, rollefilter, FAQ, ordliste. Erstatter ren `mailto:`-knapp |
| Globalt søk | Ctrl+K / knapp | Admin+kunde. Ordre/kunde/produkt/bruker, siste 5, debounce 300 ms |
| Eksport | Alle dashboard/statistikk/analyse | PDF/PNG via `ExportButton` (skala 2, mørk bakgrunn) + CSV via `DataTable`/statistikk (`fetchAllStatRows`) |
| Lagrede visninger | Ordrer/statistikk/analyse | Private for kunde/analyse, delte for admin (`SavedViewsPanel`) |
| Varslingslyd + deep-link | `NotificationBell/Watcher` | Kun admin+kunde |
| AI-hjelp | `AssistantChat` | Valgfri (`ENABLE_ASSISTANT`), kun systemhjelp — ikke livedata |
| Idle-timeout | `IdleTimer` | Auto-utlogging (prod 30 min, dev 15 min) + advarselsmodal |

---

## 3. Datamodell (salgsordre-felter du spurte om)

| Felt | Tabell.kolonne | Merknad |
|------|----------------|---------|
| Ordrenr | `ordre.ordrenr` PK | Sekvens for kundeordrer; egen sekvens for importerte ordrer |
| Kundenr | `ordre.kundenr` FK → `kunde` | + `kunde.kundenavn`, `customer_group_id` |
| Dato | `ordre.dato` DATE | Indeksert; brukes til tidsrom + ferskhet |
| Henvisning 1–5 | `ordre_henvisning.henvisning1..5` | **Linjenivå** (PK `ordrenr,linjenr`), trigram-indekser. Ordrehode har i tillegg `kundeordreref`/`kunderef` |
| Lager | `ordre.lagernavn` + `firmaid` FK → `lager` | Kompositt-PK `(lagernavn,firmaid)` |
| Firma | `ordre.firmaid` FK → `firma` | + `firma.firmanavn` |
| Kunde | `kunde` | Se over |
| Vare | `ordrelinje.varekode` FK → `vare` | + `vare.varenavn`, `base_price` |
| Varegruppe | `vare.varegruppe` | Indeksert (`idx_vare_varegruppe`) |
| Valuta | `ordre.valutaid` FK → `valuta` | NOK/EUR/USD/SEK/DKK/GBP seedet |
| Sum | `ordre.sum` DECIMAL(12,2) | Rekalkuleres i samme transaksjon ved linje-CRUD |
| Workflow | `ordre.workflow_status` | 8 tilstander, se `PROGRAMLOGIKK.md` |
| Idempotens | `ordre.idempotency_key` | Hindrer duplikat ved dobbeltklikk/retry |

---

## 4. Brukerhistorier (akseptansekriterier i kortform)

- **Som analysebruker** kan jeg velge dimensjon (lager/firma/kunde/vare/varegruppe) + tidsrom, se graf + tabell + KPI, og eksportere PDF/PNG/CSV — uten å se ETL eller brukeradmin.
- **Som kunde** kan jeg søke på ordrenr/dato/henvisning, sortere tabellen, åpne ordredetalj med tidslinje, laste ned PDF, legge varer i handlekurv til kundepris og sende bestilling — og jeg ser kun egne ordrer.
- **Som administrator** kan jeg godkjenne/avvise kø, redigere ordrelinjer (legg til/endre/slett), sette base-pris, styre prisregler, kjøre ETL/import, sjekke status for uttrekk/import/frontend-backend, og spore alt i endringsloggen.

---

## 5. Ikke-funksjonelle egenskaper

| Egenskap | Hvordan det oppfylles |
|----------|----------------------|
| Ytelse | Paginering (20/25/50), server-sortering (admin), React Query-cache, prefetch på hover, `batch`-statistikk, materialized views, trigram- og ytelsesindekser, `COPY`-import for 100k+ rader, SSE i stedet for polling for ETL |
| Brukervennlighet | Rolestyrte menyer, norsk UI (`nb-NO`), mobil bunnmeny, tom-tilstander, skeleton/spinner, `Ctrl+K`, lagrede visninger, onboarding, hjelpeside |
| Pålitelighet | Transaksjoner, idempotens-nøkkel, overgangsregler + 409 ved konflikt, overlap-guard i scheduler, fail-closed token-sjekk, `x-request-id`, strukturert logging (pino), Prometheus-metrikk |
| Sikkerhet | JWT 1h + refresh-rotasjon, bcrypt, `token_version`-dreping, `roleGuard`, radfiltrering, Zod-validering, parametrisert SQL, rate-limiting, `helmet`, CORS-lås, destruktiv ETL blokkert i prod uten flagg |
| Sporbarhet | `ordre_status_history` (tidslinje) + `audit_log` (append-only) + scheduler/ETL-logger |
| Dokumentasjon | Denne filen + `API.md` + `PROGRAMLOGIKK.md` + `ARCHITECTURE.md` + `DEPLOY.md` + `/hjelp` |

---

## 6. Kjente begrensninger (ærlig liste)

1. **Kunde-sortering er klient-side** (`serverSort=false`): sorterer kun gjeldende side. Admin har server-sortering. Anbefalt forbedring: send `sortBy/sortDir` også for kunde.
2. **Frontend-helse er antatt:** `GET /status/health` rapporterer frontend som «assumed healthy» med konfigurert URL — ingen aktiv probe. Anbefalt: enkel uptime-sjekk fra backend eller RUM-metrikk via `/client-events`.
3. **`docs/API.md` må holdes manuelt synkronisert** med `routes/` — ingen OpenAPI-generator ennå. Anbefalt: generer OpenAPI fra Zod-skjemaer på sikt.
4. **Henvisningssøk er fritekst:** treffer alle 5 feltene, men UI har ikke 5 separate felt. Tilstrekkelig for MVP; vurder avansert-filter ved behov.
5. **Custom-job-oppretting er stub:** `POST /scheduler/jobs` aksepterer kun forhåndsdefinerte `taskType` og returnerer «not fully implemented».

---

## 7. Videreutvikling (forslag, ikke forpliktelse)

- Server-sortering for kunde-tabellen.
- Ekte frontend-probe + RUM-dashboard.
- OpenAPI-generering + kontraktstester.
- Avansert henvisningsfilter (H1–H5 separat).
- Bulk-operasjoner på ordrelinjer + angre-funksjon.
- Eksportmaler (firmalogo i PDF) + planlagte rapporter på e-post.

Se `PROGRAMLOGIKK.md §10` for teknisk gjeld og migreringsnotater.
