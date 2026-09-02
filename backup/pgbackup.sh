#!/bin/sh
# Nightly pg_dump sidecar for Tess production.
# Runs inside the postgres:15-alpine image (same major as prod db).
# Dumps custom-format (-Fc) to /backups, prunes older than retention.
#
# Required env: POSTGRES_USER, POSTGRES_PASSWORD
# Optional env: POSTGRES_DB (default tess), POSTGRES_HOST (default db),
#               BACKUP_RETENTION_DAYS (default 7)
set -eu

: "${POSTGRES_USER:?POSTGRES_USER must be set}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
POSTGRES_HOST="${POSTGRES_HOST:-db}"
POSTGRES_DB="${POSTGRES_DB:-tess}"
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
export PGPASSWORD="$POSTGRES_PASSWORD"

mkdir -p /backups

while true; do
  TS="$(date +%Y%m%d-%H%M%S)"
  FILE="/backups/tess-${TS}.dump"
  if pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f "$FILE"; then
    echo "backup ok: $FILE $(du -h "$FILE" | cut -f1)"
  else
    echo "backup FAILED for $FILE" >&2
    rm -f "$FILE"
  fi
  # Prune files older than retention (mtime +N = strictly more than N days)
  find /backups -maxdepth 1 -name 'tess-*.dump' -mtime "+$((BACKUP_RETENTION_DAYS - 1))" -delete
  sleep 86400
done
