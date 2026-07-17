#!/bin/sh
set -eu

umask 077

readonly EXPECTED_HOST="10.240.116.2"
readonly EXPECTED_DATABASE="giq_rehearsal_restore_v8"
readonly EXPECTED_USER="postgres"
readonly HISTORICAL_CUTOFF="2026-07-01T00:00:00Z"

die() {
  printf 'OPERATOR_ATTENTION: %s\n' "$*" >&2
  exit 1
}

[ -n "${DEST_DATABASE_PASSWORD:-}" ] || die "DEST_DATABASE_PASSWORD is required"

export PGHOST="$EXPECTED_HOST"
export PGPORT="5432"
export PGDATABASE="$EXPECTED_DATABASE"
export PGUSER="$EXPECTED_USER"
export PGPASSWORD="$DEST_DATABASE_PASSWORD"
export PGSSLMODE="require"
export PGCONNECT_TIMEOUT="30"
export PGOPTIONS="-c default_transaction_read_only=on"

database_identity="$(psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --command='SELECT current_database();')"
[ "$database_identity" = "$EXPECTED_DATABASE" ] || \
  die "database identity mismatch: expected $EXPECTED_DATABASE, observed $database_identity"

psql --no-psqlrc --set=ON_ERROR_STOP=1 --tuples-only --no-align \
  --set=historical_cutoff="$HISTORICAL_CUTOFF" <<'SQL'
WITH
role_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role', rolname,
        'login', rolcanlogin,
        'superuser', rolsuper,
        'bypassRls', rolbypassrls,
        'inherit', rolinherit
      ) ORDER BY rolname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_roles
  WHERE rolname IN (
    'greyhoundiq_app',
    'greyhoundiq_migrator',
    'greyhoundiq_runtime'
  )
),
role_memberships AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('member', member.rolname, 'role', parent.rolname)
      ORDER BY member.rolname, parent.rolname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_auth_members membership
  JOIN pg_roles parent ON parent.oid = membership.roleid
  JOIN pg_roles member ON member.oid = membership.member
  WHERE parent.rolname LIKE 'greyhoundiq_%'
     OR member.rolname LIKE 'greyhoundiq_%'
),
migration_inventory AS (
  SELECT jsonb_build_object(
    'rows', COUNT(*),
    'completed', COUNT(*) FILTER (
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
    ),
    'unfinished', COUNT(*) FILTER (
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ),
    'rolledBack', COUNT(*) FILTER (
      WHERE finished_at IS NULL AND rolled_back_at IS NOT NULL
    ),
    'latestFinishedAt', MAX(finished_at)
  ) AS value
  FROM public."_prisma_migrations"
),
unfinished_migration_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'migration', migration_name,
        'startedAt', started_at,
        'appliedSteps', applied_steps_count,
        'rolledBackAt', rolled_back_at
      ) ORDER BY started_at
    ),
    '[]'::jsonb
  ) AS value
  FROM public."_prisma_migrations"
  WHERE finished_at IS NULL
    AND rolled_back_at IS NULL
),
admin_function_inventory AS (
  SELECT jsonb_build_object(
    'exists', COUNT(DISTINCT procedure.oid) = 1,
    'owner', MAX(owner.rolname),
    'publicExecute', COALESCE(
      BOOL_OR(
        privilege.grantee = 0
        AND privilege.privilege_type = 'EXECUTE'
      ),
      false
    )
  ) AS value
  FROM pg_proc procedure
  JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
  JOIN pg_roles owner ON owner.oid = procedure.proowner
  LEFT JOIN LATERAL aclexplode(
    COALESCE(procedure.proacl, acldefault('f', procedure.proowner))
  ) privilege ON true
  WHERE namespace.nspname = 'public'
    AND procedure.proname = 'giq_is_admin'
    AND procedure.pronargs = 0
),
catalog_inventory AS (
  SELECT jsonb_build_object(
    'baseTables', (
      SELECT COUNT(*)
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ),
    'rlsTables', (
      SELECT COUNT(*)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relrowsecurity
    ),
    'forceRlsTables', (
      SELECT COUNT(*)
      FROM pg_class relation
      JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
      WHERE namespace.nspname = 'public'
        AND relation.relkind IN ('r', 'p')
        AND relation.relforcerowsecurity
    ),
    'foreignKeys', COUNT(*) FILTER (WHERE contype = 'f'),
    'invalidForeignKeys', COUNT(*) FILTER (
      WHERE contype = 'f' AND NOT convalidated
    ),
    'invalidConstraints', COUNT(*) FILTER (WHERE NOT convalidated),
    'disabledTriggers', (
      SELECT COUNT(*) FROM pg_trigger WHERE tgenabled = 'D'
    )
  ) AS value
  FROM pg_constraint
),
cluster_database_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'database', database.datname,
        'bytes', pg_database_size(database.datname),
        'allowConnections', database.datallowconn,
        'activeConnections', (
          SELECT COUNT(*)
          FROM pg_stat_activity activity
          WHERE activity.datname = database.datname
        )
      ) ORDER BY database.datname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_database database
  WHERE NOT database.datistemplate
),
row_counts AS (
  SELECT jsonb_build_object(
    'Dog', (SELECT COUNT(*) FROM public."Dog"),
    'DogProfileArchive', (SELECT COUNT(*) FROM public."DogProfileArchive"),
    'DogProfileForm', (SELECT COUNT(*) FROM public."DogProfileForm"),
    'FormEntry', (SELECT COUNT(*) FROM public."FormEntry"),
    'Meeting', (SELECT COUNT(*) FROM public."Meeting"),
    'Race', (SELECT COUNT(*) FROM public."Race"),
    'RaceDayArchive', (SELECT COUNT(*) FROM public."RaceDayArchive"),
    'RaceVideo', (SELECT COUNT(*) FROM public."RaceVideo"),
    'Result', (SELECT COUNT(*) FROM public."Result"),
    'Runner', (SELECT COUNT(*) FROM public."Runner"),
    'Track', (SELECT COUNT(*) FROM public."Track"),
    'Trainer', (SELECT COUNT(*) FROM public."Trainer")
  ) AS value
),
storage_reference_inventory AS (
  SELECT jsonb_build_object(
    'mediaAssets', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bucket', inventory."storageBucket",
            'processingStatus', inventory."processingStatus",
            'scanStatus', inventory."scanStatus",
            'objects', inventory.objects,
            'bytes', inventory.bytes
          ) ORDER BY inventory."storageBucket", inventory."processingStatus", inventory."scanStatus"
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT "storageBucket", "processingStatus", "scanStatus",
               COUNT(*) AS objects, COALESCE(SUM("sizeBytes"), 0) AS bytes
        FROM public."MediaAsset"
        WHERE "deletedAt" IS NULL
        GROUP BY "storageBucket", "processingStatus", "scanStatus"
      ) inventory
    ),
    'exportArtifacts', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bucket', inventory."storageBucket",
            'status', inventory.status,
            'objects', inventory.objects,
            'bytes', inventory.bytes
          ) ORDER BY inventory."storageBucket", inventory.status
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT "storageBucket", status, COUNT(*) AS objects,
               COALESCE(SUM("sizeBytes"), 0) AS bytes
        FROM public."ExportArtifact"
        WHERE "storageBucket" IS NOT NULL AND "storagePath" IS NOT NULL
        GROUP BY "storageBucket", status
      ) inventory
    ),
    'pendingDeletionJobs', (
      SELECT COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'bucket', inventory."storageBucket",
            'status', inventory.status,
            'objects', inventory.objects
          ) ORDER BY inventory."storageBucket", inventory.status
        ),
        '[]'::jsonb
      )
      FROM (
        SELECT "storageBucket", status, COUNT(*) AS objects
        FROM public."DeletionJob"
        WHERE "storageBucket" IS NOT NULL AND "storagePath" IS NOT NULL
        GROUP BY "storageBucket", status
      ) inventory
    )
  ) AS value
),
race_coverage AS (
  SELECT jsonb_build_object(
    'earliestRaceTime', MIN("raceTime"),
    'latestRaceTime', MAX("raceTime"),
    'historicalBeforeCutoff', COUNT(*) FILTER (
      WHERE "raceTime" < :'historical_cutoff'::timestamptz
    ),
    'cutoffOrNewer', COUNT(*) FILTER (
      WHERE "raceTime" >= :'historical_cutoff'::timestamptz
    ),
    'withReplayUrl', COUNT(*) FILTER (
      WHERE NULLIF(BTRIM("replayUrl"), '') IS NOT NULL
    ),
    'withPhotoFinishUrl', COUNT(*) FILTER (
      WHERE NULLIF(BTRIM("photoFinishUrl"), '') IS NOT NULL
    ),
    'latestSourceSync', MAX("lastSyncedAt")
  ) AS value
  FROM public."Race"
),
pedigree_coverage AS (
  SELECT jsonb_build_object(
    'withSire', COUNT(*) FILTER (WHERE "sireId" IS NOT NULL),
    'withDam', COUNT(*) FILTER (WHERE "damId" IS NOT NULL),
    'withBothParents', COUNT(*) FILTER (
      WHERE "sireId" IS NOT NULL AND "damId" IS NOT NULL
    ),
    'withProviderIdentity', COUNT(*) FILTER (
      WHERE "sourceProvider" IS NOT NULL AND "sourceId" IS NOT NULL
    ),
    'syntheticEarBrands', COUNT(*) FILTER (
      WHERE "earBrand" LIKE 'thedogs:%'
    ),
    'placeholderLikeNames', COUNT(*) FILTER (
      WHERE name ~ ' (NBT|[0-9]{1,2}\\.[0-9]{2})$'
    ),
    'selfSireLinks', COUNT(*) FILTER (WHERE id = "sireId"),
    'selfDamLinks', COUNT(*) FILTER (WHERE id = "damId")
  ) AS value
  FROM public."Dog"
),
sensitive_rls AS (
  SELECT jsonb_build_object(
    'sensitivePolicies', COUNT(*),
    'moderatorPredicates', COUNT(*) FILTER (
      WHERE COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
        LIKE '%giq_is_moderator()%'
    ),
    'adminPredicates', COUNT(*) FILTER (
      WHERE COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
        LIKE '%giq_is_admin()%'
    )
  ) AS value
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'giq_billing_customer_read',
      'giq_billing_customer_write',
      'giq_billing_event_read',
      'giq_billing_event_write',
      'giq_credit_note_read',
      'giq_credit_note_write',
      'giq_entitlement_snapshot_read',
      'giq_entitlement_snapshot_write',
      'giq_invoice_read',
      'giq_invoice_write',
      'giq_media_delete',
      'giq_media_select',
      'giq_media_update',
      'giq_payment_read',
      'giq_payment_write',
      'giq_plan_entitlement_write',
      'giq_plan_write',
      'giq_price_catalog_write',
      'giq_profile_update',
      'giq_refund_read',
      'giq_refund_write',
      'giq_subscription_read',
      'giq_subscription_write',
      'giq_usage_aggregate_read',
      'giq_usage_aggregate_write',
      'giq_usage_event_read',
      'giq_usage_event_write',
      'giq_usage_outbox_read',
      'giq_usage_outbox_write',
      'giq_user_select',
      'giq_user_update',
      'giq_webhook_event_system'
    )
),
sensitive_policy_inventory AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'command', cmd,
        'policy', policyname,
        'table', tablename
      ) ORDER BY tablename, policyname
    ),
    '[]'::jsonb
  ) AS value
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'BillingCustomer',
      'BillingEvent',
      'CreditNoteRecord',
      'EntitlementSnapshot',
      'InvoiceRecord',
      'MediaAsset',
      'PaymentRecord',
      'Plan',
      'PlanEntitlement',
      'PriceCatalog',
      'Profile',
      'RefundRecord',
      'Subscription',
      'UsageAggregate',
      'UsageEvent',
      'UsageOutbox',
      'User',
      'WebhookEvent'
    )
)
SELECT jsonb_pretty(
  jsonb_build_object(
    'auditKind', 'alloydb-production-read-only',
    'adminFunction', admin_function_inventory.value,
    'database', current_database(),
    'historicalCutoff', :'historical_cutoff',
    'catalog', catalog_inventory.value,
    'clusterDatabases', cluster_database_inventory.value,
    'migrations', migration_inventory.value,
    'unfinishedMigrations', unfinished_migration_inventory.value,
    'pedigree', pedigree_coverage.value,
    'raceCoverage', race_coverage.value,
    'roles', role_inventory.value,
    'roleMemberships', role_memberships.value,
    'rowCounts', row_counts.value,
    'storageReferences', storage_reference_inventory.value,
    'sensitivePolicyInventory', sensitive_policy_inventory.value,
    'sensitiveRls', sensitive_rls.value
  )
)
FROM catalog_inventory
CROSS JOIN admin_function_inventory
CROSS JOIN cluster_database_inventory
CROSS JOIN migration_inventory
CROSS JOIN unfinished_migration_inventory
CROSS JOIN pedigree_coverage
CROSS JOIN race_coverage
CROSS JOIN role_inventory
CROSS JOIN role_memberships
CROSS JOIN row_counts
CROSS JOIN storage_reference_inventory
CROSS JOIN sensitive_policy_inventory
CROSS JOIN sensitive_rls;
SQL

printf 'PRODUCTION_DB_READ_ONLY_AUDIT_COMPLETE database=%s\n' "$EXPECTED_DATABASE"
