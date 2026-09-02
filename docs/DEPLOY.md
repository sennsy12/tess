# Production deployment (Docker Compose)

This guide covers deploying Tess with `docker-compose.prod.yml`. Development uses `docker-compose.yml` and `seed-dev.sql` — **do not mount seed data in production**.

## Prerequisites

- Docker and Docker Compose v2
- A domain pointed at your server (for Caddy TLS)
- Secrets generated locally (never commit `.env.prod`)

## 1. Configure environment

```bash
cp .env.prod.example .env.prod
```

Edit `.env.prod` and set at minimum:

| Variable | Notes |
|----------|--------|
| `DB_PASSWORD` | Strong database password |
| `JWT_SECRET` | At least 32 characters (`openssl rand -base64 48`) |
| `ADMIN_ACTION_KEY` | At least 16 characters, not a common word |
| `FRONTEND_URL` | Public origin, e.g. `https://yourdomain.com` (CORS) |
| `VITE_API_URL` | Usually `https://yourdomain.com/api` |

Leave `ENABLE_DESTRUCTIVE_ETL=false` and `ENABLE_SCHEDULER_JOBS=false` unless you explicitly need dev-style tooling in a controlled environment.

Update `Caddyfile` with your domain before deploy.

## 2. Deploy

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

On first start:

- Postgres runs `init.sql` once (empty volume only)
- Backend runs SQL migrations from `backend/src/db/migrations/` automatically
- Readiness: `GET /api/health/ready` (DB + pool stats)

## 3. Post-deploy checklist

1. **First admin account** — no admin is seeded by `init.sql`. Set `ADMIN_USERNAME`/`ADMIN_PASSWORD` in `.env.prod` before first boot; the backend creates it at startup (`db/bootstrapAdmin.ts`) and refuses to start without it.
2. Verify health: `curl https://yourdomain.com/api/health/ready`
3. Confirm CORS: log in from the browser at your public URL
4. Confirm backups: `docker compose -f docker-compose.prod.yml --env-file .env.prod exec backup ls -lh /backups` (first dump appears ~1 min after the backup sidecar starts)
5. Review logs: `docker compose -f docker-compose.prod.yml logs -f backend`

## 4. Upgrades

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod pull
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

Migrations apply on backend startup. For manual migration:

```bash
docker compose -f docker-compose.prod.yml exec backend npm run migrate
```

## 5. Rollback

- Re-deploy a previous image tag if using a registry
- Database rollback: restore from backup (migrations are forward-only)

## Health endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Liveness — process up |
| `GET /api/health/ready` | Readiness — database reachable |

## Observability

| Signal | Where |
|--------|-------|
| Logs | JSON to stdout (all services), rotated 3×10 MB by the docker log driver. Secrets are redacted by the backend logger. Correlate with the `x-request-id` response header. |
| Prometheus | Backend exposes `GET /metrics` (latency histogram, request counter, pool gauges). Reachable only inside the compose network — Caddy intentionally does not proxy it. Scrape it with a Prometheus running on `tess-prod-network`, or `exec` into a container. |
| Admin UI | `GET /api/status/api-metrics` (in-memory per-replica feed for the Status/Dashboard pages) — human overview, not alerting source. |

## Backups & restore

- **What**: the `backup` service runs `pg_dump -Fc` nightly into the `pgbackup_prod_data` volume and prunes dumps older than `BACKUP_RETENTION_DAYS` (default 7). **RPO: 24h.**
- **List dumps**: `docker compose -f docker-compose.prod.yml --env-file .env.prod exec backup ls -lh /backups`
- **Restore drill (to a scratch container — never into prod directly)**:

```bash
# 1. Copy the newest dump out of the volume
docker compose -f docker-compose.prod.yml --env-file .env.prod cp backup:/backups/tess-20250101-000000.dump ./drill.dump
# 2. Start a scratch Postgres (same major as prod: 15)
docker run -d --name tess-restore-drill -e POSTGRES_PASSWORD=drill postgres:15-alpine
docker cp ./drill.dump tess-restore-drill:/tmp/drill.dump
# 3. Restore and compare row counts
docker exec tess-restore-drill pg_restore -U postgres -d postgres --clean --if-exists /tmp/drill.dump
docker exec tess-restore-drill psql -U postgres -c "SELECT count(*) FROM ordre;"
# 4. Clean up
docker rm -f tess-restore-drill && rm ./drill.dump
```

- **Real restore**: stop the backend (`docker compose ... stop backend`), restore the dump into `db` with `pg_restore --clean`, restart. Migrations are forward-only — a backup from before a deploy plus `npm run migrate` on boot is the rollback path.
- Copy dumps off-host regularly (the volume dies with the host).

## Volumes

| Volume | Purpose |
|--------|---------|
| `postgres_prod_data` | Database files |
| `uploads_prod_data` | ETL uploaded files |
| `caddy_data` / `caddy_config` | TLS certificates |
