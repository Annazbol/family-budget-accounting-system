#!/usr/bin/env bash
# Usage: DATABASE_URL=postgresql://postgres:1111@localhost:5432/budget ./sql/apply_all.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DB="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/budget}"

echo ">> 001_schema.sql"
psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/001_schema.sql"
echo ">> 002_legacy_upgrade.sql"
psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/002_legacy_upgrade.sql"
echo ">> 003_operations_source.sql"
psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/003_operations_source.sql"
echo "OK: migrations applied"
