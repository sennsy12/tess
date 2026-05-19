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

1. **Change default admin password** — `init.sql` seeds `admin` with a documented dev password; rotate immediately in production.
2. Verify health: `curl https://yourdomain.com/api/health/ready`
3. Confirm CORS: log in from the browser at your public URL
4. Configure database backups for the `postgres_prod_data` volume
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

## Volumes

| Volume | Purpose |
|--------|---------|
| `postgres_prod_data` | Database files |
| `uploads_prod_data` | ETL uploaded files |
| `caddy_data` / `caddy_config` | TLS certificates |
