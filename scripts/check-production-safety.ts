import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MEDIA_CONTEXTS,
  resolveMediaBucket,
} from "../src/lib/media-validation";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isPublicStorageBucket,
} from "../src/lib/storage-paths";
import { validateGcpArchitectureContract } from "./gcp-architecture-policy";

const root = process.cwd();
const workflowDir = join(root, ".github", "workflows");
const workflows = readdirSync(workflowDir)
  .filter((file) => /\.(ya?ml)$/i.test(file))
  .map((file) => ({
    file,
    text: readFileSync(join(workflowDir, file), "utf8"),
  }));

const findings: string[] = [];

try {
  const architectureContract = JSON.parse(
    readFileSync(join(root, "config", "gcp-architecture.json"), "utf8"),
  );
  for (const finding of validateGcpArchitectureContract(architectureContract)) {
    findings.push(`gcp-architecture.json: ${finding}`);
  }
} catch (error) {
  findings.push(
    `gcp-architecture.json: unreadable or invalid JSON (${error instanceof Error ? error.message : "unknown error"})`,
  );
}

for (const context of MEDIA_CONTEXTS) {
  const expected =
    context === "site" ? SITE_ASSETS_BUCKET : PRIVATE_USER_MEDIA_BUCKET;
  if (resolveMediaBucket({ mediaContext: context }) !== expected) {
    findings.push(
      `media-validation: ${context} uploads must resolve to ${expected}`,
    );
  }
}
if (isPublicStorageBucket(PUBLIC_USER_MEDIA_BUCKET)) {
  findings.push(
    "storage-paths: legacy public-user-media bucket must be treated as private",
  );
}
if (
  resolveMediaBucket({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    mediaContext: "feed",
  }) !== PRIVATE_USER_MEDIA_BUCKET
) {
  findings.push(
    "media-validation: client bucket overrides must not bypass quarantine",
  );
}
const mediaService = readFileSync(
  join(root, "src", "lib", "media-service.ts"),
  "utf8",
);
if (!mediaService.includes("/quarantine/${input.context}/")) {
  findings.push("media-service: user upload paths must remain in quarantine");
}
for (const required of [
  "await refreshClamAvDefinitions()",
  'process.env.MEDIA_FRESHCLAM_BIN?.trim() || "freshclam"',
  'throw new Error("media.clamav_definitions_stale")',
]) {
  if (!mediaService.includes(required)) {
    findings.push(
      `media-service: missing ClamAV runtime freshness guard ${required}`,
    );
  }
}
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
for (const required of [
  "DatabaseOwner nextjs",
  "chown -R nextjs:nodejs /var/lib/clamav /var/log/clamav",
  "USER nextjs",
]) {
  if (!dockerfile.includes(required)) {
    findings.push(
      `Dockerfile: missing non-root ClamAV runtime contract ${required}`,
    );
  }
}
const userMediaMigration = readFileSync(
  join(
    root,
    "prisma",
    "migrations",
    "20260710133500_private_user_media_quarantine",
    "migration.sql",
  ),
  "utf8",
);
for (const required of [
  "SET public = false",
  "GreyhoundIQ public read public user media",
  "GreyhoundIQ upload public user media",
  "GreyhoundIQ upload private user media",
  "GreyhoundIQ deny direct user media select",
  "GreyhoundIQ deny direct user media insert",
]) {
  if (!userMediaMigration.includes(required)) {
    findings.push(`user-media migration: missing ${required}`);
  }
}
const dangerousWorkflowCommands = [
  /prisma\s+db\s+push/i,
  /prisma\s+migrate\s+reset/i,
  /npm\s+run\s+db:push/i,
  /npm\s+run\s+db:reset/i,
  /npm\s+run\s+bootstrap/i,
];

for (const workflow of workflows) {
  for (const pattern of dangerousWorkflowCommands) {
    if (pattern.test(workflow.text)) {
      findings.push(`${workflow.file}: contains dangerous command ${pattern}`);
    }
  }
}

const ci = workflow("ci.yml");
if (
  !ci.includes(
    "DATABASE_URL: postgresql://postgres:postgres@localhost:5432/greyhoundiq",
  )
) {
  findings.push(
    "ci.yml: db:seed must use the disposable local Postgres service",
  );
}
if (!ci.includes("npm run check:production-safety")) {
  findings.push("ci.yml: missing production safety gate");
}
if (!ci.includes("npm run check:calls")) {
  findings.push("ci.yml: missing call token permission gate");
}
if (!ci.includes("npm run check:marketplace-safety")) {
  findings.push("ci.yml: missing marketplace safety gate");
}
if (!ci.includes("npm run check:visibility-policies")) {
  findings.push("ci.yml: missing visibility policy gate");
}
if (!ci.includes("gitleaks/gitleaks@sha256:")) {
  findings.push("ci.yml: missing pinned Gitleaks secret scan");
}
if (!ci.includes("semgrep/semgrep@sha256:")) {
  findings.push("ci.yml: missing pinned Semgrep SAST scan");
}
for (const requiredEnv of [
  "LAGO_API_URL",
  "LAGO_FRONT_URL",
  "LAGO_API_KEY",
  "LAGO_WEBHOOK_SECRET",
]) {
  if (!ci.includes(`${requiredEnv}:`)) {
    findings.push(`ci.yml: missing ${requiredEnv} for production env gate`);
  }
}
for (const requiredEnv of [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
]) {
  if (!ci.includes(`${requiredEnv}:`)) {
    findings.push(`ci.yml: missing ${requiredEnv} for production env gate`);
  }
}

const migrate = workflow("supabase-migrate.yml");
if (
  !migrate.includes("Block production seed") ||
  !migrate.includes(
    "inputs.environment == 'production' && inputs.seed == true",
  ) ||
  !migrate.includes("exit 1")
) {
  findings.push("supabase-migrate.yml: production seed blocker is missing");
}
if (
  !migrate.includes("inputs.environment != 'production' && inputs.seed == true")
) {
  findings.push("supabase-migrate.yml: seed step must be non-production only");
}
if (!migrate.includes("npm run check:migrations")) {
  findings.push("supabase-migrate.yml: missing migration safety gate");
}
const indexPreparationPosition = migrate.indexOf("npm run db:indexes:prepare");
const migrateDeployPosition = migrate.indexOf("npx prisma migrate deploy");
if (
  indexPreparationPosition < 0 ||
  indexPreparationPosition > migrateDeployPosition
) {
  findings.push(
    "supabase-migrate.yml: concurrent index preparation must run before migration deploy",
  );
}
if (!migrate.includes("group: supabase-migrate-${{ inputs.environment }}")) {
  findings.push(
    "supabase-migrate.yml: migrations must be serialized per environment",
  );
}

const cloudRunDeploy = workflow("cloud-run-deploy.yml");
if (
  !cloudRunDeploy.includes("workflow_run:") ||
  !cloudRunDeploy.includes('workflows: ["CI"]')
) {
  findings.push(
    "cloud-run-deploy.yml: deploy must wait for CI workflow success",
  );
}
if (
  !cloudRunDeploy.includes("github.event.workflow_run.conclusion == 'success'")
) {
  findings.push("cloud-run-deploy.yml: missing CI success condition");
}
if (
  !cloudRunDeploy.includes('min_instances="3"') ||
  !cloudRunDeploy.includes('--min "$min_instances"') ||
  cloudRunDeploy.includes('--min-instances "$min_instances"')
) {
  findings.push(
    "cloud-run-deploy.yml: web service-level min instances must stay at the tuned value",
  );
}
if (!cloudRunDeploy.includes("--concurrency 20")) {
  findings.push(
    "cloud-run-deploy.yml: web concurrency must stay at the tuned value",
  );
}
if (!cloudRunDeploy.includes("--cpu-boost")) {
  findings.push("cloud-run-deploy.yml: startup CPU boost must stay enabled");
}
if (
  !cloudRunDeploy.includes(
    "SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_JWT_SECRET NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY",
  )
) {
  findings.push("cloud-run-deploy.yml: missing web Supabase secret preflight");
}
for (const publicSecret of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  if (
    !cloudRunDeploy.includes(
      "for var_name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ) ||
    !cloudRunDeploy.includes(
      "$var_name GitHub secret is required for Cloud Run deploys",
    )
  ) {
    findings.push(
      `cloud-run-deploy.yml: missing ${publicSecret} public Supabase preflight`,
    );
  }
}
for (const livekitSecret of [
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
]) {
  if (
    !cloudRunDeploy.includes(
      `${livekitSecret}=greyhoundiq-$env_name-${livekitSecret}:latest`,
    )
  ) {
    findings.push(
      `cloud-run-deploy.yml: missing ${livekitSecret} secret mapping`,
    );
  }
}
for (const stripeSecret of [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
]) {
  if (
    !cloudRunDeploy.includes(
      `${stripeSecret}=greyhoundiq-$env_name-${stripeSecret}:latest`,
    )
  ) {
    findings.push(
      `cloud-run-deploy.yml: missing ${stripeSecret} secret mapping`,
    );
  }
}
if (!cloudRunDeploy.includes("STRIPE_APP_URL=$nextauth_url")) {
  findings.push(
    "cloud-run-deploy.yml: STRIPE_APP_URL must follow NEXTAUTH_URL",
  );
}
if (
  !cloudRunDeploy.includes(
    'scanner_service_account="giq-media-scanner-$env_name@$project_id.iam.gserviceaccount.com"',
  ) ||
  !cloudRunDeploy.includes('--service-account "$scanner_service_account"')
) {
  findings.push(
    "cloud-run-deploy.yml: scanner must use its dedicated runtime service account",
  );
}
for (const required of [
  "OBJECT_STORAGE_PROVIDER=gcs",
  "GCS_SITE_ASSETS_BUCKET=$site_assets_bucket",
  "GCS_PUBLIC_USER_MEDIA_BUCKET=$public_user_media_bucket",
  "GCS_PRIVATE_USER_MEDIA_BUCKET=$private_user_media_bucket",
  'scanner_secrets="DATABASE_URL=$database_secret:latest,INTERNAL_API_SECRET=$internal_api_secret:latest"',
  'runtime_sa" != "giq-web-$env_name@$project_id.iam.gserviceaccount.com',
  "${{ vars.MEDIA_SCANNER_INTERNAL_API_SECRET_NAME }}",
  '[ "$reviewed_internal_api_secret" = "giq-internal-api-secret" ]',
  '--set-secrets "$scanner_secrets"',
  '"--vpc-egress=$vpc_egress"',
  '.httpTarget.httpMethod == "POST"',
  ".httpTarget.oidcToken.audience == $audience",
  '.attemptDeadline == "900s"',
]) {
  if (!cloudRunDeploy.includes(required)) {
    findings.push(
      `cloud-run-deploy.yml: missing scanner fail-closed contract ${required}`,
    );
  }
}
const workflowScannerBlock =
  /scanner_service="greyhoundiq-media-scanner-\$env_name"([\s\S]*?)echo "scanner_service=/.exec(
    cloudRunDeploy,
  )?.[1] ?? "";
if (
  !workflowScannerBlock ||
  workflowScannerBlock.includes('--update-secrets "$secrets"') ||
  workflowScannerBlock.includes('scanner_env_vars="${env_vars')
) {
  findings.push(
    "cloud-run-deploy.yml: scanner must not inherit the web environment or full secret bundle",
  );
}
for (const publicSupabaseSecret of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  if (
    !cloudRunDeploy.includes(
      `${publicSupabaseSecret}=greyhoundiq-$env_name-${publicSupabaseSecret}:latest`,
    )
  ) {
    findings.push(
      `cloud-run-deploy.yml: missing ${publicSupabaseSecret} runtime secret mapping`,
    );
  }
}
if (
  !cloudRunDeploy.includes(
    "REPLAY_PROXY_SECRET=greyhoundiq-$env_name-REPLAY_PROXY_SECRET:latest",
  )
) {
  findings.push(
    "cloud-run-deploy.yml: missing REPLAY_PROXY_SECRET runtime secret mapping",
  );
}

const cloudRunDeployPs1 = readFileSync(
  join(root, "scripts", "gcp-cloud-run-deploy.ps1"),
  "utf8",
);
if (!cloudRunDeployPs1.includes("[int]$WebConcurrency = 20")) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: web concurrency must stay at the tuned value",
  );
}
const legacyScannerGuard = cloudRunDeployPs1.indexOf(
  "if (-not $SkipMediaScanner)",
);
const legacyCloudSetup = cloudRunDeployPs1.search(/\r?\nAdd-GcloudToPath\r?\n/);
if (
  legacyScannerGuard < 0 ||
  legacyCloudSetup < 0 ||
  legacyScannerGuard > legacyCloudSetup ||
  !cloudRunDeployPs1.includes("legacy scanner deploy path is disabled")
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: legacy scanner deployment must fail before Cloud SDK setup",
  );
}
if (!cloudRunDeployPs1.includes('"--cpu-boost"')) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: startup CPU boost must stay enabled",
  );
}
if (!cloudRunDeployPs1.includes('$minInstances = "3"')) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: web min instances must stay at the tuned value",
  );
}
const webDeployArgsBlock =
  cloudRunDeployPs1.match(/\$deployArgs = @\([\s\S]*?\n\)/)?.[0] ?? "";
if (!webDeployArgsBlock.includes('"--timeout=900"')) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: web timeout must cover aggregate maintenance",
  );
}

const monitoringSetup = readFileSync(
  join(root, "scripts", "gcp-monitoring-setup.sh"),
  "utf8",
);
for (const monitoringNeedle of [
  "${PROJECT:?Set PROJECT to the approved production Google Cloud project ID}",
  "${NOTIFICATION_CHANNEL:?Set NOTIFICATION_CHANNEL to the reviewed Cloud Monitoring channel resource name}",
  '[[ ! "$PROJECT" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]',
  '[[ ! "$PROD_HOST" =~ ^[A-Za-z0-9.-]+$ ]]',
  '[[ ! "$PROD_SERVICE" =~ ^[a-z]([a-z0-9-]{0,47}[a-z0-9])?$ ]]',
  'channel_prefix="projects/$PROJECT/notificationChannels/"',
  'channel_id="${CHANNEL#"$channel_prefix"}"',
  '[[ ! "$channel_id" =~ ^[A-Za-z0-9_-]+$ ]]',
  "GCP_MONITORING_VALIDATE_ONLY",
  'if ! uptime_inventory="$(gcloud monitoring uptime list-configs',
  'if ! metric_names="$(gcloud logging metrics list',
  'if ! policy_inventory="$(gcloud beta monitoring policies list',
  "refusing monitoring mutations",
  'gcloud logging metrics "$action" "$name"',
  'gcloud beta monitoring policies update "$policy_names"',
  "Duplicate alert policies require operator review",
  "greyhoundiq_prod_rate_limit_prune_attention",
  'jsonPayload.event=\\"aggregate_refresh.rate_limit_prune_attention\\"',
  "greyhoundiq_prod_aggregate_refresh_completed",
  'jsonPayload.event=\\"aggregate_refresh.run_completed\\"',
  "greyhoundiq_prod_aggregate_scheduler_failures",
  "google.cloud.scheduler.logging.AttemptFinished",
  '"conditionAbsent"',
  '"duration": "5400s"',
  "GreyhoundIQ prod rate-limit cleanup needs attention",
  "GreyhoundIQ prod aggregate refresh completion missing",
  "GreyhoundIQ prod aggregate Scheduler attempt failed",
  '"owner": "sre"',
  "incident-response-controls.md#rate-limit-cleanup-backlog",
  "for f in 5xx latency instances dbfail ratelimit-prune aggregate-missing aggregate-scheduler-failure scheduled-task-attention scheduler-failure uptime",
]) {
  if (!monitoringSetup.includes(monitoringNeedle)) {
    findings.push(
      `gcp-monitoring-setup.sh: aggregate cleanup monitoring missing ${monitoringNeedle}`,
    );
  }
}
if (monitoringSetup.includes("Policy already exists, skipping")) {
  findings.push(
    "gcp-monitoring-setup.sh: alert policy drift must not be silently skipped",
  );
}
for (const schedulerNeedle of [
  'Name = "greyhoundiq-$Environment-aggregate-refresh"',
  'Schedule = "20 * * * *"',
  'Uri = "$baseUrl/api/internal/aggregate-refresh"',
  'AttemptDeadline = "840s"',
]) {
  if (!cloudRunDeployPs1.includes(schedulerNeedle)) {
    findings.push(
      `gcp-cloud-run-deploy.ps1: aggregate scheduler missing ${schedulerNeedle}`,
    );
  }
}
if (
  !cloudRunDeployPs1.includes(
    '$scannerRequiredSecrets = @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")',
  )
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: missing scanner Supabase secret preflight",
  );
}
if (
  !cloudRunDeployPs1.includes(
    '$scannerServiceAccount = "giq-media-scanner-$Environment@$ProjectId.iam.gserviceaccount.com"',
  ) ||
  !cloudRunDeployPs1.includes('"--service-account=$scannerServiceAccount"')
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: scanner must retain its dedicated service account",
  );
}
if (
  !cloudRunDeployPs1.includes(
    '$NextPublicSupabaseUrl = Required-Value $NextPublicSupabaseUrl "NEXT_PUBLIC_SUPABASE_URL"',
  )
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_URL must be required",
  );
}
if (
  !cloudRunDeployPs1.includes(
    '$NextPublicSupabaseAnonKey = Required-Value $NextPublicSupabaseAnonKey "NEXT_PUBLIC_SUPABASE_ANON_KEY"',
  )
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_ANON_KEY must be required",
  );
}
const deployRequiredSecretsBlock =
  cloudRunDeployPs1.match(/\$requiredSecrets = @\([\s\S]*?\)/)?.[0] ?? "";
if (!deployRequiredSecretsBlock.includes('"REPLAY_PROXY_SECRET"')) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: REPLAY_PROXY_SECRET must be a required web secret",
  );
}
for (const supabaseSecret of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
]) {
  if (!deployRequiredSecretsBlock.includes(`"${supabaseSecret}"`)) {
    findings.push(
      `gcp-cloud-run-deploy.ps1: ${supabaseSecret} must be a required web secret`,
    );
  }
}
for (const publicSupabaseSecret of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  if (!deployRequiredSecretsBlock.includes(`"${publicSupabaseSecret}"`)) {
    findings.push(
      `gcp-cloud-run-deploy.ps1: ${publicSupabaseSecret} must be a required web secret`,
    );
  }
}
if (
  cloudRunDeployPs1.includes(
    '$plainEnvItems += "NEXT_PUBLIC_SUPABASE_URL=$NextPublicSupabaseUrl"',
  )
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_URL runtime value must use Secret Manager",
  );
}
if (
  cloudRunDeployPs1.includes(
    '$plainEnvItems += "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NextPublicSupabaseAnonKey"',
  )
) {
  findings.push(
    "gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_ANON_KEY runtime value must use Secret Manager",
  );
}

const cloudRunBootstrapPs1 = readFileSync(
  join(root, "scripts", "gcp-cloud-run-bootstrap.ps1"),
  "utf8",
);
if (!cloudRunBootstrapPs1.includes('"REPLAY_PROXY_SECRET"')) {
  findings.push(
    "gcp-cloud-run-bootstrap.ps1: must create REPLAY_PROXY_SECRET secret shell",
  );
}
if (!cloudRunBootstrapPs1.includes("--public-access-prevention")) {
  findings.push(
    "gcp-cloud-run-bootstrap.ps1: GCS buckets must enforce public access prevention",
  );
}
for (const publicSupabaseSecret of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  if (!cloudRunBootstrapPs1.includes(`"${publicSupabaseSecret}"`)) {
    findings.push(
      `gcp-cloud-run-bootstrap.ps1: must create ${publicSupabaseSecret} secret shell`,
    );
  }
}

const cloudRunBootstrapSh = readFileSync(
  join(root, "scripts", "gcp-cloud-run-bootstrap.sh"),
  "utf8",
);
if (!/^\s*REPLAY_PROXY_SECRET\s*$/m.test(cloudRunBootstrapSh)) {
  findings.push(
    "gcp-cloud-run-bootstrap.sh: must create REPLAY_PROXY_SECRET secret shell",
  );
}
for (const publicSupabaseSecret of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
]) {
  if (!cloudRunBootstrapSh.includes(publicSupabaseSecret)) {
    findings.push(
      `gcp-cloud-run-bootstrap.sh: must create ${publicSupabaseSecret} secret shell`,
    );
  }
}

const gcsCorsPolicy = JSON.parse(
  readFileSync(join(root, "config", "gcs-object-storage-cors.json"), "utf8"),
);
const expectedGcsCorsPolicy = [
  {
    origin: ["https://greyhoundsiq.com.au", "https://www.greyhoundsiq.com.au"],
    method: ["GET", "HEAD", "PUT"],
    responseHeader: [
      "Content-Type",
      "Content-Length",
      "Content-Range",
      "Range",
      "ETag",
      "x-goog-generation",
      "x-goog-hash",
      "x-goog-if-generation-match",
    ],
    maxAgeSeconds: 3600,
  },
];
if (JSON.stringify(gcsCorsPolicy) !== JSON.stringify(expectedGcsCorsPolicy)) {
  findings.push(
    "gcs-object-storage-cors.json: must keep the exact approved origins, methods, response headers and max age",
  );
}
const gcsObjectStorageReconciler = readFileSync(
  join(root, "scripts", "gcp-object-storage-reconcile.ps1"),
  "utf8",
);
for (const required of [
  '"giq-site-assets-$ProjectId"',
  '"giq-public-user-media-$ProjectId"',
  '"giq-private-user-media-$ProjectId"',
  '"--uniform-bucket-level-access"',
  '"--public-access-prevention"',
  '"--cors-file=$corsFile"',
  "Write-CorsBackup",
  "RestoreDirectory",
]) {
  if (!gcsObjectStorageReconciler.includes(required)) {
    findings.push(`gcp-object-storage-reconcile.ps1: missing ${required}`);
  }
}
const mediaScannerReconciler = readFileSync(
  join(root, "scripts", "gcp-media-scanner-reconcile.ps1"),
  "utf8",
);
for (const required of [
  '"greyhoundiq-media-scanner-$Environment"',
  '"greyhoundiq-$Environment-media-maintenance"',
  '"giq-media-scanner-$Environment@$ProjectId.iam.gserviceaccount.com"',
  'MEDIA_SCAN_MODE = "clamav"',
  'REALTIME_BROADCAST_DISABLED = "true"',
  "DATABASE_URL = $databaseSecretRef",
  "INTERNAL_API_SECRET = $internalSecretRef",
  "Get-ScannerEnvironmentDrift",
  "Get-NetworkContract",
  "Get-DirectSecretAccess",
  "Test-ProjectSecretAccessor",
  "ReviewedInternalApiSecretName",
  '"--no-allow-unauthenticated"',
  '"--oidc-service-account-email=$webServiceAccount"',
  '"--oidc-token-audience=$scannerUrl"',
  '"--attempt-deadline=900s"',
  '"--role=roles/storage.objectUser"',
]) {
  if (!mediaScannerReconciler.includes(required)) {
    findings.push(`gcp-media-scanner-reconcile.ps1: missing ${required}`);
  }
}
if (/run", "deploy", \$WebServiceName/.test(mediaScannerReconciler)) {
  findings.push(
    "gcp-media-scanner-reconcile.ps1: scanner drift repair must not redeploy the web service",
  );
}
if (
  /foreach \(\$entry in @\(\$webContainer\.env\)\)/.test(mediaScannerReconciler)
) {
  findings.push(
    "gcp-media-scanner-reconcile.ps1: scanner must not clone every web environment or secret binding",
  );
}

const packageJson = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
) as {
  scripts?: Record<string, string>;
};
const ciScript = packageJson.scripts?.ci ?? "";
for (const required of [
  "npm run check:production-safety",
  "npm run check:migrations",
  "npm run check:calls",
  "npm run check:marketplace-safety",
  "npm run check:visibility-policies",
]) {
  if (!ciScript.includes(required)) {
    findings.push(`package.json: ci script missing ${required}`);
  }
}

if (findings.length > 0) {
  console.error("Production safety gate failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log("Production safety gate passed.");

function workflow(name: string) {
  const found = workflows.find((item) => item.file === name);
  if (!found) {
    findings.push(`${name}: workflow missing`);
    return "";
  }
  return found.text;
}
