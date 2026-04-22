#!/usr/bin/env bash
#
# JHSC Advisor — full PostgreSQL backup
#
# Reads DATABASE_URL from the environment, runs pg_dump, and writes
# the resulting SQL dump to /home/jhsc_backups/jhsc_backup_YYYY-MM-DD.sql.
# Logs success or failure with an ISO-8601 timestamp.

set -u
set -o pipefail

BACKUP_DIR="/home/jhsc_backups"
DATE_STAMP="$(date +%F)"                       # YYYY-MM-DD
TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"            # ISO-8601 UTC for logs
OUT_FILE="${BACKUP_DIR}/jhsc_backup_${DATE_STAMP}.sql"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[${TS}] [BACKUP] FAILURE: DATABASE_URL is not set" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR" || {
  echo "[${TS}] [BACKUP] FAILURE: could not create ${BACKUP_DIR}" >&2
  exit 1
}

echo "[${TS}] [BACKUP] Starting pg_dump → ${OUT_FILE}"

if pg_dump --no-owner --no-privileges --format=plain --file="$OUT_FILE" "$DATABASE_URL"; then
  SIZE="$(stat -c%s "$OUT_FILE" 2>/dev/null || echo "?")"
  END_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[${END_TS}] [BACKUP] SUCCESS: ${OUT_FILE} (${SIZE} bytes)"
  exit 0
else
  RC=$?
  END_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "[${END_TS}] [BACKUP] FAILURE: pg_dump exited with code ${RC}" >&2
  rm -f "$OUT_FILE" 2>/dev/null || true
  exit "$RC"
fi
