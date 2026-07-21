#!/bin/sh
set -eu

umask 077

readonly EXPECTED_DATABASE="giq_production_stage11_20260718_r2"
readonly ALLOYDB_INSTANCE_URI="projects/clever-bee-502514-m4/locations/australia-southeast1/clusters/giq-rehearsal-syd/instances/giq-rehearsal-syd-primary"
readonly DEST_HOST="127.0.0.1"
readonly DEST_PORT="5432"
readonly DEST_USER="postgres"
readonly DEFAULT_ARCHIVE_PATH="/mnt/history/releases/giq-production-public-stage11-r2-20260718T2126AEST.dir"
readonly DEFAULT_CHECKSUM_PATH="/mnt/history/releases/giq-production-public-stage11-r2-20260718T2126AEST.sha256"
readonly EXPECTED_ARCHIVE_FILES="116"
readonly EXPECTED_ARCHIVE_SIZE="2781982754"
readonly EXPECTED_CHECKSUM_SHA256="4ea0ec9862ce161d87b7568fe5abee5c79315e42ef3d5f0a66dde3f40662974a"
readonly EXPECTED_TOC_ENTRIES="1479"
readonly VERIFIED_DATABASE_MARKER="giq-stage11-verified:${EXPECTED_CHECKSUM_SHA256}"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${DEST_DATABASE_PASSWORD:-}" ] || die "DEST_DATABASE_PASSWORD is required"

readonly DEST_DATABASE="$EXPECTED_DATABASE"
readonly ARCHIVE_PATH="$DEFAULT_ARCHIVE_PATH"
readonly CHECKSUM_PATH="$DEFAULT_CHECKSUM_PATH"
readonly RESTORE_JOBS="8"
readonly RECREATE_INCOMPLETE_DATABASE="${RECREATE_INCOMPLETE_DATABASE:-}"

[ -d "$ARCHIVE_PATH" ] || die "directory archive is not readable at the configured mount path"
[ -r "$CHECKSUM_PATH" ] || die "archive checksum file is not readable at the configured mount path"

actual_checksum_sha256="$(sha256sum "$CHECKSUM_PATH" | awk '{print $1}')"
[ "$actual_checksum_sha256" = "$EXPECTED_CHECKSUM_SHA256" ] || \
  die "archive checksum manifest SHA-256 mismatch"

actual_files="$(find "$ARCHIVE_PATH" -maxdepth 1 -type f | wc -l | tr -d '[:space:]')"
[ "$actual_files" = "$EXPECTED_ARCHIVE_FILES" ] || \
  die "archive file count mismatch: expected $EXPECTED_ARCHIVE_FILES files, observed $actual_files"

actual_size="$(find "$ARCHIVE_PATH" -maxdepth 1 -type f -printf '%s\n' | awk '{ total += $1 } END { printf "%.0f", total }')"
[ "$actual_size" = "$EXPECTED_ARCHIVE_SIZE" ] || \
  die "archive size mismatch: expected $EXPECTED_ARCHIVE_SIZE bytes, observed $actual_size"

if ! (cd "$ARCHIVE_PATH" && sha256sum --check --strict --quiet "$CHECKSUM_PATH"); then
  die "one or more directory-archive files failed SHA-256 verification"
fi

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
[ "$toc_entries" = "$EXPECTED_TOC_ENTRIES" ] || \
  die "archive table-of-contents mismatch: expected $EXPECTED_TOC_ENTRIES entries, observed ${toc_entries:-none}"

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

printf 'Archive verified: files=%s bytes=%s toc_entries=%s checksums_sha256=%s\n' \
  "$actual_files" "$actual_size" "$toc_entries" "$actual_checksum_sha256"

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
  database_marker="$(psql_admin --tuples-only --no-align --command="SELECT COALESCE(shobj_description(oid, 'pg_database'), '') FROM pg_database WHERE datname = '$EXPECTED_DATABASE';")"
  if [ "$database_marker" != "$VERIFIED_DATABASE_MARKER" ] && \
     [ "$RECREATE_INCOMPLETE_DATABASE" = "$EXPECTED_DATABASE" ]; then
    database_owner="$(psql_admin --tuples-only --no-align --command="SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$EXPECTED_DATABASE';")"
    [ "$database_owner" = "$DEST_USER" ] || \
      die "refusing to recreate an incomplete database owned by $database_owner"

    printf 'Recreating the exact incomplete isolated Stage 11 database after explicit confirmation.\n'
    psql_admin --command="ALTER DATABASE \"$EXPECTED_DATABASE\" ALLOW_CONNECTIONS false;"
    psql_admin --command="SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$EXPECTED_DATABASE' AND pid <> pg_backend_pid();"
    psql_admin --command="DROP DATABASE \"$EXPECTED_DATABASE\";"
    database_exists=""
  fi
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

  printf 'Creating required PostgreSQL extensions in the existing public schema.\n'
  psql_history --command='CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;'
  psql_history --command='CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;'

  # The public-only archive contains an exact public-schema entry. Keep the
  # template0 public schema because it now owns the required extensions.
  sed -i \
    -e '/ SCHEMA - public /s/^/;/' \
    -e '/ COMMENT - SCHEMA public /s/^/;/' \
    -e '/ ROW SECURITY /s/^/;/' \
    "$toc_path"

  printf 'Restoring the verified archive into the isolated database.\n'
  if ! PGOPTIONS='-c app.system=true -c app.current_role=system -c app.current_tier=system' \
    pg_restore \
    --host="$DEST_HOST" \
    --port="$DEST_PORT" \
    --username="$DEST_USER" \
    --dbname="$DEST_DATABASE" \
    --no-owner \
    --no-acl \
    --no-tablespaces \
    --exit-on-error \
    --verbose \
    --jobs="$RESTORE_JOBS" \
    --use-list="$toc_path" \
    "$ARCHIVE_PATH"; then
    die "restore failed; the isolated database was retained for diagnosis and production was not changed"
  fi

  deferred_rls_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_class relation JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace WHERE namespace.nspname = 'public' AND relation.relkind IN ('r', 'p') AND relation.relforcerowsecurity AND NOT relation.relrowsecurity;")"
  [ "$deferred_rls_count" = "114" ] || \
    die "deferred RLS inventory mismatch: expected 114 tables, observed $deferred_rls_count"

  printf 'Enabling RLS after all foreign keys have been restored and validated.\n'
  psql_history <<'SQL'
DO $$
DECLARE
  relation record;
BEGIN
  FOR relation IN
    SELECT namespace.nspname AS schema_name, class.relname AS relation_name
    FROM pg_class class
    JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relkind IN ('r', 'p')
      AND class.relforcerowsecurity
      AND NOT class.relrowsecurity
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
      relation.schema_name,
      relation.relation_name
    );
  END LOOP;
END
$$;
SQL

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
assert_table_count "DogProfileArchive" "50006"
assert_table_count "Meeting" "76861"
assert_table_count "Race" "840552"
assert_table_count "Runner" "5291521"
assert_table_count "Result" "4659242"
assert_table_count "FormEntry" "4787733"
assert_table_count "Dog" "228756"
assert_table_count "DogProfileForm" "4639876"
assert_table_count "Trainer" "14026"
assert_table_count "Track" "76"
assert_table_count "RaceVideo" "290140"

migration_row_count="$(psql_history --tuples-only --no-align --command='SELECT COUNT(*) FROM public."_prisma_migrations";')"
[ "$migration_row_count" = "103" ] || \
  die "migration row count mismatch: expected 103 rows, observed $migration_row_count"

migration_count="$(psql_history --tuples-only --no-align --command='SELECT COUNT(*) FROM public."_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;')"
[ "$migration_count" = "101" ] || \
  die "migration count mismatch: expected 101 completed migrations, observed $migration_count"

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
[ "$base_table_count" = "115" ] || \
  die "base-table inventory mismatch: expected 115, observed $base_table_count"

rls_table_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity;")"
[ "$rls_table_count" = "114" ] || \
  die "RLS inventory mismatch: expected 114 enabled tables, observed $rls_table_count"

force_rls_table_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relforcerowsecurity;")"
[ "$force_rls_table_count" = "114" ] || \
  die "FORCE RLS inventory mismatch: expected 114 tables, observed $force_rls_table_count"

foreign_key_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f';")"
[ "$foreign_key_count" = "209" ] || \
  die "foreign-key inventory mismatch: expected 209, observed $foreign_key_count"

disabled_trigger_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM pg_trigger WHERE tgenabled = 'D';")"
[ "$disabled_trigger_count" = "0" ] || \
  die "the restored database contains $disabled_trigger_count disabled triggers"

public_connect_grant="$(psql_admin --tuples-only --no-align --command="SELECT COALESCE(bool_or(acl.grantee = 0 AND acl.privilege_type = 'CONNECT'), false) FROM pg_database db CROSS JOIN LATERAL aclexplode(COALESCE(db.datacl, acldefault('d', db.datdba))) acl WHERE db.datname = '$EXPECTED_DATABASE';")"
[ "$public_connect_grant" = "f" ] || \
  die "PUBLIC still has CONNECT on the isolated database"

history_start="$(psql_history --tuples-only --no-align --command="SELECT to_char(min(\"meetingDate\"), 'YYYY-MM-DD') FROM public.\"Meeting\";")"
[ "$history_start" = "2006-08-01" ] || \
  die "historical coverage mismatch: expected 2006-08-01, observed $history_start"

history_years="$(psql_history --tuples-only --no-align --command='SELECT COUNT(DISTINCT extract(year FROM "meetingDate")) FROM public."Meeting";')"
[ "$history_years" = "21" ] || \
  die "historical year coverage mismatch: expected 21 years, observed $history_years"

invalid_replay_count="$(psql_history --tuples-only --no-align --command="SELECT COUNT(*) FROM public.\"RaceVideo\" video LEFT JOIN public.\"Race\" race ON race.id = video.\"raceId\" WHERE race.id IS NULL OR coalesce(video.\"sourceId\", '') = '' OR coalesce(video.\"pageUrl\", '') = '';")"
[ "$invalid_replay_count" = "0" ] || \
  die "restored replay inventory contains $invalid_replay_count invalid references"

database_size="$(psql_history --tuples-only --no-align --command="SELECT pg_database_size(current_database());")"

psql_admin --command="COMMENT ON DATABASE \"$EXPECTED_DATABASE\" IS '$VERIFIED_DATABASE_MARKER';"

printf 'FULL_HISTORY_RESTORE_VERIFIED database=%s bytes=%s migrations=%s tables=%s rls=%s force_rls=%s foreign_keys=%s invalid_foreign_keys=%s invalid_constraints=%s disabled_triggers=%s\n' \
  "$DEST_DATABASE" "$database_size" "$migration_count" "$base_table_count" "$rls_table_count" \
  "$force_rls_table_count" "$foreign_key_count" "$invalid_fk_count" "$invalid_constraint_count" "$disabled_trigger_count"
