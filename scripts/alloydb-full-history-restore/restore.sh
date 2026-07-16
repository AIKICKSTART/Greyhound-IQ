#!/bin/sh
set -eu

umask 077

readonly EXPECTED_DATABASE="giq_full_history_rehearsal_20260716_r2"
readonly ALLOYDB_INSTANCE_URI="projects/clever-bee-502514-m4/locations/australia-southeast1/clusters/giq-rehearsal-syd/instances/giq-rehearsal-syd-primary"
readonly DEST_HOST="127.0.0.1"
readonly DEST_PORT="5432"
readonly DEST_USER="postgres"
readonly DEFAULT_ARCHIVE_PATH="/mnt/history/archives/giq-full-history-20260716-r2.dump"
readonly DEFAULT_ARCHIVE_SIZE="3292766394"
readonly DEFAULT_ARCHIVE_SHA256="e0ac35834d111fba43f6ab24ac9723fa3097efcb9a443790b673aa353dcc3443"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${DEST_DATABASE_PASSWORD:-}" ] || die "DEST_DATABASE_PASSWORD is required"

readonly DEST_DATABASE="$EXPECTED_DATABASE"
readonly ARCHIVE_PATH="$DEFAULT_ARCHIVE_PATH"
readonly EXPECTED_ARCHIVE_SIZE="$DEFAULT_ARCHIVE_SIZE"
readonly EXPECTED_ARCHIVE_SHA256="$DEFAULT_ARCHIVE_SHA256"
readonly RESTORE_JOBS="1"

[ -r "$ARCHIVE_PATH" ] || die "archive is not readable at the configured mount path"

actual_size="$(wc -c < "$ARCHIVE_PATH" | tr -d '[:space:]')"
[ "$actual_size" = "$EXPECTED_ARCHIVE_SIZE" ] || \
  die "archive size mismatch: expected $EXPECTED_ARCHIVE_SIZE bytes, observed $actual_size"

actual_sha256="$(sha256sum "$ARCHIVE_PATH" | awk '{print $1}')"
[ "$actual_sha256" = "$EXPECTED_ARCHIVE_SHA256" ] || \
  die "archive SHA-256 mismatch"

toc_path="$(mktemp)"
proxy_pid=""

cleanup() {
  rm -f "$toc_path"
  if [ -n "$proxy_pid" ] && kill -0 "$proxy_pid" 2>/dev/null; then
    kill "$proxy_pid" 2>/dev/null || true
    wait "$proxy_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT HUP INT TERM
pg_restore --list "$ARCHIVE_PATH" > "$toc_path"
toc_entries="$(awk '/TOC Entries:/ { print $4; exit }' "$toc_path")"
[ "$toc_entries" = "1372" ] || \
  die "archive table-of-contents mismatch: expected 1372 entries, observed ${toc_entries:-none}"

export PGPASSWORD="$DEST_DATABASE_PASSWORD"
export PGSSLMODE="disable"
export PGCONNECT_TIMEOUT="30"

psql_admin() {
  psql \
    --host="$DEST_HOST" \
    --port="$DEST_PORT" \
    --username="$DEST_USER" \
    --dbname=postgres \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    "$@"
}

psql_history() {
  psql \
    --host="$DEST_HOST" \
    --port="$DEST_PORT" \
    --username="$DEST_USER" \
    --dbname="$DEST_DATABASE" \
    --no-psqlrc \
    --set=ON_ERROR_STOP=1 \
    "$@"
}

printf 'Archive verified: bytes=%s toc_lines=%s sha256=%s\n' \
  "$actual_size" "$toc_entries" "$actual_sha256"

printf 'Starting the IAM-authenticated AlloyDB proxy for the approved instance.\n'
/usr/local/bin/alloydb-auth-proxy \
  --address "$DEST_HOST" \
  --port "$DEST_PORT" \
  --structured-logs \
  "$ALLOYDB_INSTANCE_URI" &
proxy_pid="$!"

proxy_ready="false"
proxy_attempt="1"
while [ "$proxy_attempt" -le 30 ]; do
  if ! kill -0 "$proxy_pid" 2>/dev/null; then
    die "the AlloyDB Auth Proxy exited before accepting a connection"
  fi
  if psql_admin --tuples-only --no-align --command='SELECT 1;' >/dev/null 2>&1; then
    proxy_ready="true"
    break
  fi
  sleep 2
  proxy_attempt="$((proxy_attempt + 1))"
done

[ "$proxy_ready" = "true" ] || die "the AlloyDB Auth Proxy did not become ready within 60 seconds"

if ! database_exists="$(psql_admin --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname = '$EXPECTED_DATABASE';")"; then
  die "could not query the destination AlloyDB catalog"
fi

if [ "$database_exists" = "1" ]; then
  printf 'Database already exists; skipping restore and running idempotent verification.\n'
else
  printf 'Creating isolated database %s.\n' "$DEST_DATABASE"
  if ! createdb \
    --host="$DEST_HOST" \
    --port="$DEST_PORT" \
    --username="$DEST_USER" \
    --template=template0 \
    "$DEST_DATABASE"; then
    die "could not create the isolated database"
  fi

  if ! psql_admin --command="REVOKE CONNECT ON DATABASE \"$EXPECTED_DATABASE\" FROM PUBLIC;"; then
    die "could not revoke PUBLIC connection access from the isolated database"
  fi

  printf 'Restoring the verified archive into the isolated database.\n'
  if ! PGOPTIONS='-c app.system=true -c app.current_role=system -c app.current_tier=system' \
    pg_restore \
    --host="$DEST_HOST" \
    --port="$DEST_PORT" \
    --username="$DEST_USER" \
    --dbname="$DEST_DATABASE" \
    --no-owner \
    --no-acl \
    --enable-row-security \
    --exit-on-error \
    --verbose \
    --jobs="$RESTORE_JOBS" \
    "$ARCHIVE_PATH"; then
    die "restore failed; the isolated database was retained for diagnosis and production was not changed"
  fi

  printf 'Refreshing planner statistics in the isolated database.\n'
  psql_history --command='ANALYZE;'
fi

assert_table_count() {
  table_name="$1"
  expected_count="$2"
  actual_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM public.\"$table_name\";")"
  [ "$actual_count" = "$expected_count" ] || \
    die "$table_name count mismatch: expected $expected_count, observed $actual_count"
  printf 'Verified table count: %s=%s\n' "$table_name" "$actual_count"
}

assert_table_count "RaceDayArchive" "5883"
assert_table_count "DogProfileArchive" "60273"
assert_table_count "Meeting" "76668"
assert_table_count "Race" "838672"
assert_table_count "Runner" "6435322"
assert_table_count "Result" "5627298"
assert_table_count "FormEntry" "5627293"
assert_table_count "Dog" "198947"
assert_table_count "DogProfileForm" "0"
assert_table_count "Trainer" "10682"
assert_table_count "Track" "75"
assert_table_count "RaceVideo" "0"

migration_row_count="$(psql_history --tuples-only --no-align --command='SELECT COUNT(*) FROM public."_prisma_migrations";')"
[ "$migration_row_count" = "99" ] || \
  die "migration row count mismatch: expected 99 rows, observed $migration_row_count"

migration_count="$(psql_history --tuples-only --no-align --command='SELECT COUNT(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;')"
[ "$migration_count" = "98" ] || \
  die "migration count mismatch: expected 98 completed migrations, observed $migration_count"

failed_migration_count="$(psql_history --tuples-only --no-align --command='SELECT COUNT(*) FROM public."_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL;')"
[ "$failed_migration_count" = "0" ] || \
  die "the restored database contains $failed_migration_count unfinished migrations"

invalid_fk_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f' AND NOT convalidated;")"
[ "$invalid_fk_count" = "0" ] || \
  die "the restored database contains $invalid_fk_count unvalidated foreign keys"

invalid_constraint_count="$(psql_history --tuples-only --no-align --command='SELECT COUNT(*) FROM pg_constraint WHERE NOT convalidated;')"
[ "$invalid_constraint_count" = "3" ] || \
  die "constraint inventory mismatch: expected 3 intentionally unvalidated constraints, observed $invalid_constraint_count"

base_table_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE';")"
[ "$base_table_count" = "108" ] || \
  die "base-table inventory mismatch: expected 108, observed $base_table_count"

rls_table_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity;")"
[ "$rls_table_count" = "107" ] || \
  die "RLS inventory mismatch: expected 107 enabled tables, observed $rls_table_count"

force_rls_table_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relforcerowsecurity;")"
[ "$force_rls_table_count" = "107" ] || \
  die "FORCE RLS inventory mismatch: expected 107 tables, observed $force_rls_table_count"

foreign_key_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f';")"
[ "$foreign_key_count" = "195" ] || \
  die "foreign-key inventory mismatch: expected 195, observed $foreign_key_count"

disabled_trigger_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_trigger WHERE tgenabled = 'D';")"
[ "$disabled_trigger_count" = "0" ] || \
  die "the restored database contains $disabled_trigger_count disabled triggers"

public_connect_grant="$(psql_admin --tuples-only --no-align --command="SELECT COALESCE(bool_or(acl.grantee = 0 AND acl.privilege_type = 'CONNECT'), false) FROM pg_database db CROSS JOIN LATERAL aclexplode(COALESCE(db.datacl, acldefault('d', db.datdba))) acl WHERE db.datname = '$EXPECTED_DATABASE';")"
[ "$public_connect_grant" = "f" ] || \
  die "PUBLIC still has CONNECT on the isolated database"

database_size="$(psql_history --tuples-only --no-align --command="SELECT pg_database_size(current_database());")"

printf 'FULL_HISTORY_RESTORE_VERIFIED database=%s bytes=%s migrations=%s tables=%s rls=%s force_rls=%s foreign_keys=%s invalid_foreign_keys=%s invalid_constraints=%s disabled_triggers=%s\n' \
  "$DEST_DATABASE" "$database_size" "$migration_count" "$base_table_count" "$rls_table_count" \
  "$force_rls_table_count" "$foreign_key_count" "$invalid_fk_count" "$invalid_constraint_count" "$disabled_trigger_count"
