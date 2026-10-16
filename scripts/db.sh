#!/usr/bin/env bash
# Mahalliy ma'lumotlar bazasi: up | reset | test
# psql host kompyuterda bo'lsa shuni, bo'lmasa docker konteyneri ichidagisini ishlatadi.
set -euo pipefail
cd "$(dirname "$0")/.."

DEV_DB=maktab
TEST_DB=maktab_test
LOG_DIR=.db-logs

psql_db() {
  local db=$1; shift
  if command -v psql >/dev/null 2>&1; then
    PGHOST="${PGHOST:-127.0.0.1}" PGPORT="${PGPORT:-5432}" PGUSER="${PGUSER:-postgres}" \
      PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD:-postgres}}" \
      psql -d "$db" -v ON_ERROR_STOP=1 -q "$@"
  else
    docker compose exec -T db psql -U postgres -d "$db" -v ON_ERROR_STOP=1 -q "$@"
  fi
}

recreate_db() {
  printf 'drop database if exists %s with (force);\ncreate database %s;\n' "$1" "$1" | psql_db postgres
}

# Tartib: avval auth "stub" (Supabase auth sxemasi o'rnida), keyin migratsiyalar
apply_all() {
  local db=$1; shift
  psql_db "$db" < supabase/tests/00_stub_plain_postgres.sql
  for f in supabase/migrations/*.sql; do
    echo "  -> $f"
    psql_db "$db" < "$f"
  done
  for f in "$@"; do
    echo "  -> $f"
    psql_db "$db" < "$f"
  done
}

case "${1:-}" in
  up)
    docker compose up -d --wait db
    ;;
  reset)
    recreate_db "$DEV_DB"
    apply_all "$DEV_DB"
    echo "Dev baza tayyor: $DEV_DB"
    ;;
  test)
    mkdir -p "$LOG_DIR"
    recreate_db "$TEST_DB"
    apply_all "$TEST_DB" supabase/tests/01_test_suite.sql 2>&1 | tee "$LOG_DIR/test.log"
    passed=$(grep -c 'ok  -' "$LOG_DIR/test.log" || true)
    echo "Testlar o'tdi: $passed ta tekshiruv"
    ;;
  *)
    echo "Foydalanish: scripts/db.sh up | reset | test" >&2
    exit 2
    ;;
esac
