#!/usr/bin/env bash
# Applies Supabase stand-ins + all migrations to a fresh throwaway database
# and runs the RLS tests. Needs Postgres with PostGIS available; pass a
# superuser URL (without query parameters) in DATABASE_URL.
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to a superuser connection string}"
cd "$(dirname "$0")/.."

# Always start from an empty database: images like postgis/postgis preinstall
# PostGIS into `public`, while Supabase keeps extensions in `extensions`.
TEST_DB=likewise_db_test
TEST_URL="${DATABASE_URL%/*}/$TEST_DB"
psql() { command psql -v ON_ERROR_STOP=1 -q "$@"; }

psql "$DATABASE_URL" -c "drop database if exists $TEST_DB" -c "create database $TEST_DB template template0"
trap 'psql "$DATABASE_URL" -c "drop database if exists $TEST_DB"' EXIT

psql "$TEST_URL" -f supabase/tests/supabase_stubs.sql
for migration in supabase/migrations/*.sql; do
  echo "Applying $migration"
  psql "$TEST_URL" -f "$migration"
done
psql "$TEST_URL" -f supabase/tests/rls_test.sql
