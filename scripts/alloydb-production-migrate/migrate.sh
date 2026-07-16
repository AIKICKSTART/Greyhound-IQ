#!/bin/sh
set -eu

umask 077

readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_DATABASE="giq_rehearsal_restore_v8"
readonly EXPECTED_USER="postgres"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${ADMIN_DATABASE_PASSWORD:-}" ] || die "ADMIN_DATABASE_PASSWORD is required"

encoded_password="$(node -e 'process.stdout.write(encodeURIComponent(process.env.ADMIN_DATABASE_PASSWORD))')"
export DATABASE_URL="postgresql://${EXPECTED_USER}:${encoded_password}@${EXPECTED_HOST}:5432/${EXPECTED_DATABASE}?schema=public&sslmode=require&connection_limit=1&pool_timeout=10&connect_timeout=5"
# prisma.config.ts prefers DIRECT_URL when present. Pin both variables so an
# inherited job setting cannot bypass the exact target validated below.
export DIRECT_URL="$DATABASE_URL"
unset PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK

node <<'NODE'
const target = new URL(process.env.DATABASE_URL);
const expected = {
  database: "giq_rehearsal_restore_v8",
  host: "10.240.116.2",
  user: "postgres",
};
const observed = {
  database: target.pathname.replace(/^\//u, ""),
  host: target.hostname,
  user: decodeURIComponent(target.username),
};
for (const key of Object.keys(expected)) {
  if (observed[key] !== expected[key]) {
    throw new Error(`Production migration ${key} mismatch`);
  }
}
if (target.protocol !== "postgresql:" && target.protocol !== "postgres:") {
  throw new Error("Production migration requires PostgreSQL");
}
NODE

npx prisma migrate deploy
npx prisma migrate status

printf 'PRODUCTION_MIGRATIONS_DEPLOYED database=%s\n' "$EXPECTED_DATABASE"
