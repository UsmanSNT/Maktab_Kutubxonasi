#!/usr/bin/env bash
# Ma'lumotlar bazasi buyruqlari:
#   stack:up   — Supabase stekini (db, auth, rest, api) ko'taradi
#   migrate    — hali qo'llanmagan migratsiyalarni dev bazaga qo'llaydi (qayta qo'llamaydi)
#   test       — toza PostgreSQL 16 da stub + migratsiya + 118 ta tekshiruv
# psql host kompyuterda bo'lsa shuni, bo'lmasa docker konteyner ichidagisini ishlatadi.
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_DB="${POSTGRES_DB:-maktab}"
TEST_DB=maktab_test
LOG_DIR=.db-logs

# docker rejimida qaysi konteynerga ulanish: dev uchun "db", testlar uchun "db-test"
psql_db() {
  local db=$1; shift
  if command -v psql >/dev/null 2>&1; then
    PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" \
      PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-postgres}}" \
      psql -d "$db" -v ON_ERROR_STOP=1 -q "$@"
  else
    docker compose exec -T "${DB_SERVICE:-db}" psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -q "$@"
  fi
}

recreate_db() {
  printf 'drop database if exists %s with (force);\ncreate database %s;\n' "$1" "$1" | psql_db postgres
}

# Test bazasi: stub (auth o'rnida) + migratsiyalar + test to'plami
test_all() {
  local db=$1
  psql_db "$db" < supabase/tests/00_stub_plain_postgres.sql
  for f in supabase/migrations/*.sql supabase/tests/01_test_suite.sql; do
    echo "  -> $f"
    psql_db "$db" < "$f"
  done
}

ensure_migration_table() {
  psql_db "$DEV_DB" <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.applied (
  name text primary key,
  applied_at timestamptz not null default now()
);
SQL
}

case "${1:-}" in
  stack:up)
    docker compose up -d --wait db auth rest api
    ;;
  migrate)
    ensure_migration_table
    for f in supabase/migrations/*.sql; do
      name=$(basename "$f")
      done_already=$(printf "select 1 from supabase_migrations.applied where name = '%s'" "$name" \
        | psql_db "$DEV_DB" -tA)
      if [ -n "$done_already" ]; then
        echo "  = $name (qo'llangan)"
        continue
      fi
      echo "  -> $name"
      psql_db "$DEV_DB" < "$f"
      printf "insert into supabase_migrations.applied (name) values ('%s');\n" "$name" | psql_db "$DEV_DB"
    done
    echo "Dev baza tayyor: $DEV_DB"
    ;;
  test)
    mkdir -p "$LOG_DIR"
    if ! command -v psql >/dev/null 2>&1; then
      docker compose --profile test up -d --wait db-test
      export DB_SERVICE=db-test PGPORT=5432
    fi
    DB_SERVICE=${DB_SERVICE:-db} recreate_db "$TEST_DB"
    test_all "$TEST_DB" 2>&1 | tee "$LOG_DIR/test.log"
    passed=$(grep -c 'ok  -' "$LOG_DIR/test.log" || true)
    echo "Testlar o'tdi: $passed ta tekshiruv"
    ;;
  *)
    echo "Foydalanish: scripts/db.sh stack:up | migrate | test" >&2
    exit 2
    ;;
esac
