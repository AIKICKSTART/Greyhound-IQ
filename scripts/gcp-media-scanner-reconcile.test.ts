import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.join(process.cwd(), "scripts", "gcp-media-scanner-reconcile.ps1"),
  "utf8",
);

for (const required of [
  '"greyhoundiq-media-scanner-$Environment"',
  '"greyhoundiq-$Environment-media-maintenance"',
  '"giq-media-scanner-$Environment@$ProjectId.iam.gserviceaccount.com"',
  'MEDIA_SCAN_MODE = "clamav"',
  'REALTIME_BROADCAST_DISABLED = "true"',
  'DATABASE_URL = $databaseSecretRef',
  'INTERNAL_API_SECRET = $internalSecretRef',
  "Get-ScannerEnvironmentDrift",
  "Get-NetworkContract",
  "Get-DirectSecretAccess",
  "Test-ProjectSecretAccessor",
  "ReviewedInternalApiSecretName",
  '"--memory=4Gi"',
  '"--concurrency=1"',
  '"--no-allow-unauthenticated"',
  '"--oidc-service-account-email=$webServiceAccount"',
  '"--oidc-token-audience=$scannerUrl"',
  '"--attempt-deadline=900s"',
  '"--schedule=*/5 * * * *"',
  '"--role=roles/storage.objectUser"',
]) {
  assert.ok(source.includes(required), `missing scanner reconciler contract: ${required}`);
}
assert.match(
  source,
  /--image=\$\(\$webContainer\.image\)/,
  "scanner must reuse the exact serving web image",
);
assert.equal(
  /run", "deploy", \$WebServiceName/.test(source),
  false,
  "scanner reconciliation must never redeploy the web service",
);
assert.match(
  source,
  /if \(-not \$Apply\)[\s\S]*exit 2/,
  "default mode must be a read-only drift audit",
);
assert.match(
  source,
  /Remove-Item -LiteralPath \$environmentFile/,
  "temporary environment material must be removed",
);
assert.doesNotMatch(
  source,
  /foreach \(\$entry in @\(\$webContainer\.env\)\)/,
  "scanner must never clone every web environment or secret reference",
);
assert.match(
  source,
  /Scanner identity has Secret Manager access outside the exact two-secret allowlist/,
  "apply mode must fail before mutation when the dedicated identity has excess secret access",
);
assert.match(
  source,
  /generic INTERNAL_API_SECRET requires -ReviewedInternalApiSecretName giq-internal-api-secret/,
  "generic internal auth must require an explicit reviewed parameter",
);
assert.match(
  source,
  /\$expectedDatabaseSecretName = if \(\$Environment -eq "staging"\) \{\s*"greyhoundiq-stage11-DATABASE_URL"\s*\} else \{\s*"greyhoundiq-\$Environment-DATABASE_URL"/,
  "scanner staging must use the same reviewed Stage 11 database secret as the deployment workflow",
);
assert.match(
  source,
  /\$expectedPlainEnvironment = \[ordered\]@\{[\s\S]*NODE_ENV = "production"[\s\S]*NEXT_TELEMETRY_DISABLED = "1"[\s\S]*MEDIA_SCAN_MODE = "clamav"[\s\S]*REALTIME_BROADCAST_DISABLED = "true"[\s\S]*OBJECT_STORAGE_PROVIDER = "gcs"[\s\S]*GCS_SITE_ASSETS_BUCKET[\s\S]*GCS_PUBLIC_USER_MEDIA_BUCKET[\s\S]*GCS_PRIVATE_USER_MEDIA_BUCKET[\s\S]*?\n\}/,
  "scanner plain environment must stay on the exact media-only allowlist",
);
assert.match(
  source,
  /\$expectedSecretEnvironment = \[ordered\]@\{\s*DATABASE_URL = \$databaseSecretRef\s*INTERNAL_API_SECRET = \$internalSecretRef\s*\}/,
  "scanner secret environment must contain only database and internal auth",
);

const workflow = readFileSync(
  path.join(process.cwd(), ".github", "workflows", "cloud-run-deploy.yml"),
  "utf8",
);
const scannerBlock =
  /scanner_service="greyhoundiq-media-scanner-\$env_name"([\s\S]*?)echo "scanner_service=/.exec(
    workflow,
  )?.[1] ?? "";
assert.ok(scannerBlock, "workflow scanner block must exist");
assert.match(
  scannerBlock,
  /scanner_secrets="DATABASE_URL=\$database_secret:latest,INTERNAL_API_SECRET=\$internal_api_secret:latest"/,
  "workflow scanner must mount only its two required secrets",
);
assert.doesNotMatch(
  scannerBlock,
  /--update-secrets "\$secrets"|scanner_env_vars="\$\{env_vars/,
  "workflow scanner must not inherit the web secret or environment bundle",
);
for (const required of [
  '"--vpc-egress=$vpc_egress"',
  '.httpTarget.httpMethod == "POST"',
  '.httpTarget.oidcToken.audience == $audience',
  '.attemptDeadline == "900s"',
  "Scanner environment or secret-reference allowlist verification failed.",
]) {
  assert.ok(scannerBlock.includes(required), `workflow scanner block missing: ${required}`);
}
assert.ok(
  workflow.includes('runtime_sa" != "giq-web-$env_name@$project_id.iam.gserviceaccount.com'),
  "workflow must reject a runtime identity from another environment or project",
);
assert.ok(
  workflow.includes('${{ vars.MEDIA_SCANNER_INTERNAL_API_SECRET_NAME }}') &&
    workflow.includes('[ "$reviewed_internal_api_secret" = "giq-internal-api-secret" ]'),
  "workflow must accept the generic internal secret only through its reviewed environment variable",
);
assert.ok(
  workflow.includes('database_secret="greyhoundiq-stage11-DATABASE_URL"'),
  "workflow staging must retain the reviewed Stage 11 database secret",
);

const legacyDeploy = readFileSync(
  path.join(process.cwd(), "scripts", "gcp-cloud-run-deploy.ps1"),
  "utf8",
);
const legacyGuard = legacyDeploy.indexOf("if (-not $SkipMediaScanner)");
const firstLegacyCloudSetup = legacyDeploy.search(/\r?\nAdd-GcloudToPath\r?\n/);
assert.ok(legacyGuard >= 0, "legacy scanner deploy must have a fail-closed guard");
assert.ok(
  firstLegacyCloudSetup > legacyGuard,
  "legacy scanner guard must run before any Cloud SDK setup or mutation path",
);
assert.match(
  legacyDeploy,
  /legacy scanner deploy path is disabled[\s\S]*-SkipMediaScanner[\s\S]*gcp-media-scanner-reconcile\.ps1/,
  "legacy deploy must direct operators to the reviewed scanner reconciler",
);

console.log("GCP media scanner reconciliation tests passed");
