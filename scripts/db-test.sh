#!/usr/bin/env bash
# Applies Supabase stand-ins + all migrations to a fresh database and runs the
# RLS tests. Needs Postgres with PostGIS; pass a superuser URL in DATABASE_URL.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a superuser connection string}"
cd "$(dirname "$0")/.."

psql() { command psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }

psql -f supabase/tests/supabase_stubs.sql
for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  psql -f "$migration"
done
psql -f supabase/tests/rls_test.sql
