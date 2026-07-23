#!/bin/sh
set -eu

umask 077

readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_DATABASE="giq_rehearsal_restore_v8"
readonly EXPECTED_USER="postgres"
readonly FAILED_MIGRATION="20260716120000_restrict_sensitive_rls_to_admin"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${ADMIN_DATABASE_PASSWORD:-}" ] || die "ADMIN_DATABASE_PASSWORD is required"

export PGHOST="$EXPECTED_HOST"
export PGPORT="5432"
export PGDATABASE="$EXPECTED_DATABASE"
export PGUSER="$EXPECTED_USER"
export PGPASSWORD="$ADMIN_DATABASE_PASSWORD"
export PGSSLMODE="require"
export PGCONNECT_TIMEOUT="30"

encoded_password="$(node -e 'process.stdout.write(encodeURIComponent(process.env.ADMIN_DATABASE_PASSWORD))')"
export DATABASE_URL="postgresql://${EXPECTED_USER}:${encoded_password}@${EXPECTED_HOST}:5432/${EXPECTED_DATABASE}?schema=public&sslmode=require&connection_limit=1&pool_timeout=10&connect_timeout=5"
# prisma.config.ts prefers DIRECT_URL when present. Pin both variables so the
# ledger mutation cannot be redirected by an inherited job setting.
export DIRECT_URL="$DATABASE_URL"
unset PRISMA_SCHEMA_DISABLE_ADVISORY_LOCK

database_identity="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align --command="SELECT current_database() || '|' || current_user;")"
[ "$database_identity" = "$EXPECTED_DATABASE|$EXPECTED_USER" ] || die "database identity mismatch"

psql --no-psqlrc --set=ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  migration_row_count integer;
  unfinished_count integer;
  applied_steps integer;
  admin_function_count integer;
  admin_policy_count integer;
  legacy_policy_count integer;
  target_policy_count integer;
  target_moderator_count integer;
BEGIN
  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ),
    COALESCE(MAX(applied_steps_count) FILTER (
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ), -1)
  INTO migration_row_count, unfinished_count, applied_steps
  FROM public."_prisma_migrations"
  WHERE migration_name = '20260716120000_restrict_sensitive_rls_to_admin';

  SELECT COUNT(*) INTO admin_function_count
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'giq_is_admin'
    AND procedure.pronargs = 0;

  SELECT COUNT(*) INTO admin_policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, ''))
      LIKE '%giq_is_admin()%';

  SELECT COUNT(*) INTO legacy_policy_count
  FROM (
    VALUES
      ('BillingCustomer', 'giq_billing_customer_access'),
      ('Subscription', 'giq_subscription_access'),
      ('EntitlementSnapshot', 'giq_entitlement_snapshot_access'),
      ('InvoiceRecord', 'giq_invoice_access'),
      ('PaymentRecord', 'giq_payment_access'),
      ('RefundRecord', 'giq_refund_access'),
      ('CreditNoteRecord', 'giq_credit_note_access'),
      ('BillingEvent', 'giq_billing_event_access'),
      ('UsageEvent', 'giq_usage_event_access'),
      ('UsageOutbox', 'giq_usage_outbox_access'),
      ('UsageAggregate', 'giq_usage_aggregate_access')
  ) AS expected(tablename, policyname)
  JOIN pg_policies actual
    ON actual.schemaname = 'public'
   AND actual.tablename = expected.tablename
   AND actual.policyname = expected.policyname;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (
      WHERE (COALESCE(actual.qual, '') || ' ' || COALESCE(actual.with_check, ''))
        LIKE '%giq_is_moderator()%'
    )
  INTO target_policy_count, target_moderator_count
  FROM (
    VALUES
      ('User', 'giq_user_select'),
      ('User', 'giq_user_update'),
      ('Profile', 'giq_profile_update'),
      ('MediaAsset', 'giq_media_select'),
      ('MediaAsset', 'giq_media_update'),
      ('MediaAsset', 'giq_media_delete'),
      ('Plan', 'giq_plan_write'),
      ('PriceCatalog', 'giq_price_catalog_write'),
      ('PlanEntitlement', 'giq_plan_entitlement_write'),
      ('WebhookEvent', 'giq_webhook_event_system')
  ) AS expected(tablename, policyname)
  JOIN pg_policies actual
    ON actual.schemaname = 'public'
   AND actual.tablename = expected.tablename
   AND actual.policyname = expected.policyname;

  IF migration_row_count <> 1
     OR unfinished_count <> 1
     OR applied_steps <> 0
     OR admin_function_count <> 0
     OR admin_policy_count <> 0
     OR legacy_policy_count <> 11
     OR target_policy_count <> 10
     OR target_moderator_count <> 10 THEN
    RAISE EXCEPTION
      'recovery precondition failed: rows %, unfinished %, steps %, function %, admin policies %, legacy policies %, target policies %, moderator policies %',
      migration_row_count, unfinished_count, applied_steps, admin_function_count,
      admin_policy_count, legacy_policy_count, target_policy_count,
      target_moderator_count;
  END IF;
END
$$;
SQL

npx prisma migrate resolve --rolled-back "$FAILED_MIGRATION"

resolved_count="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --set=failed_migration="$FAILED_MIGRATION" \
  --command="SELECT COUNT(*) FROM public.\"_prisma_migrations\" WHERE migration_name = :'failed_migration' AND finished_at IS NULL AND rolled_back_at IS NOT NULL;")"
[ "$resolved_count" = "1" ] || die "migration rollback marker verification failed"

printf 'PRODUCTION_FAILED_MIGRATION_MARKED_ROLLED_BACK database=%s migration=%s\n' \
  "$EXPECTED_DATABASE" "$FAILED_MIGRATION"
