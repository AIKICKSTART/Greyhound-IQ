import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { MEDIA_CONTEXTS, resolveMediaBucket } from "../src/lib/media-validation";
import {
  PRIVATE_USER_MEDIA_BUCKET,
  PUBLIC_USER_MEDIA_BUCKET,
  SITE_ASSETS_BUCKET,
  isPublicStorageBucket,
} from "../src/lib/storage-paths";

const root = process.cwd();
const workflowDir = join(root, ".github", "workflows");
const workflows = readdirSync(workflowDir)
  .filter((file) => /\.(ya?ml)$/i.test(file))
  .map((file) => ({
    file,
    text: readFileSync(join(workflowDir, file), "utf8"),
  }));

const findings: string[] = [];

for (const context of MEDIA_CONTEXTS) {
  const expected = context === "site" ? SITE_ASSETS_BUCKET : PRIVATE_USER_MEDIA_BUCKET;
  if (resolveMediaBucket({ mediaContext: context }) !== expected) {
    findings.push(`media-validation: ${context} uploads must resolve to ${expected}`);
  }
}
if (isPublicStorageBucket(PUBLIC_USER_MEDIA_BUCKET)) {
  findings.push("storage-paths: legacy public-user-media bucket must be treated as private");
}
if (
  resolveMediaBucket({
    bucket: PUBLIC_USER_MEDIA_BUCKET,
    mediaContext: "feed",
  }) !== PRIVATE_USER_MEDIA_BUCKET
) {
  findings.push("media-validation: client bucket overrides must not bypass quarantine");
}
const mediaService = readFileSync(join(root, "src", "lib", "media-service.ts"), "utf8");
if (!mediaService.includes("/quarantine/${input.context}/")) {
  findings.push("media-service: user upload paths must remain in quarantine");
}
for (const required of [
  "await refreshClamAvDefinitions()",
  'process.env.MEDIA_FRESHCLAM_BIN?.trim() || "freshclam"',
  'throw new Error("media.clamav_definitions_stale")',
]) {
  if (!mediaService.includes(required)) {
    findings.push(`media-service: missing ClamAV runtime freshness guard ${required}`);
  }
}
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");
for (const required of [
  "DatabaseOwner nextjs",
  "chown -R nextjs:nodejs /var/lib/clamav /var/log/clamav",
  "USER nextjs",
]) {
  if (!dockerfile.includes(required)) {
    findings.push(`Dockerfile: missing non-root ClamAV runtime contract ${required}`);
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
if (!ci.includes("DATABASE_URL: postgresql://postgres:postgres@localhost:5432/greyhoundiq")) {
  findings.push("ci.yml: db:seed must use the disposable local Postgres service");
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
for (const requiredEnv of ["LAGO_API_URL", "LAGO_FRONT_URL", "LAGO_API_KEY", "LAGO_WEBHOOK_SECRET"]) {
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
  !migrate.includes("inputs.environment == 'production' && inputs.seed == true") ||
  !migrate.includes("exit 1")
) {
  findings.push("supabase-migrate.yml: production seed blocker is missing");
}
if (!migrate.includes("inputs.environment != 'production' && inputs.seed == true")) {
  findings.push("supabase-migrate.yml: seed step must be non-production only");
}
if (!migrate.includes("npm run check:migrations")) {
  findings.push("supabase-migrate.yml: missing migration safety gate");
}
const indexPreparationPosition = migrate.indexOf("npm run db:indexes:prepare");
const migrateDeployPosition = migrate.indexOf("npx prisma migrate deploy");
if (indexPreparationPosition < 0 || indexPreparationPosition > migrateDeployPosition) {
  findings.push("supabase-migrate.yml: concurrent index preparation must run before migration deploy");
}
if (!migrate.includes("group: supabase-migrate-${{ inputs.environment }}")) {
  findings.push("supabase-migrate.yml: migrations must be serialized per environment");
}

const cloudRunDeploy = workflow("cloud-run-deploy.yml");
if (!cloudRunDeploy.includes("workflow_run:") || !cloudRunDeploy.includes('workflows: ["CI"]')) {
  findings.push("cloud-run-deploy.yml: deploy must wait for CI workflow success");
}
if (!cloudRunDeploy.includes("github.event.workflow_run.conclusion == 'success'")) {
  findings.push("cloud-run-deploy.yml: missing CI success condition");
}
if (!cloudRunDeploy.includes('min_instances="3"')) {
  findings.push("cloud-run-deploy.yml: web min instances must stay at the tuned value");
}
if (!cloudRunDeploy.includes("--concurrency 20")) {
  findings.push("cloud-run-deploy.yml: web concurrency must stay at the tuned value");
}
if (!cloudRunDeploy.includes("--cpu-boost")) {
  findings.push("cloud-run-deploy.yml: startup CPU boost must stay enabled");
}
if (!cloudRunDeploy.includes("for secret_name in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY SUPABASE_JWT_SECRET NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
  findings.push("cloud-run-deploy.yml: missing scanner Supabase secret preflight");
}
for (const publicSecret of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (
    !cloudRunDeploy.includes("for var_name in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY") ||
    !cloudRunDeploy.includes("$var_name GitHub secret is required for Cloud Run deploys")
  ) {
    findings.push(`cloud-run-deploy.yml: missing ${publicSecret} public Supabase preflight`);
  }
}
for (const livekitSecret of ["LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]) {
  if (!cloudRunDeploy.includes(`${livekitSecret}=greyhoundiq-$env_name-${livekitSecret}:latest`)) {
    findings.push(`cloud-run-deploy.yml: missing ${livekitSecret} secret mapping`);
  }
}
for (const stripeSecret of [
  "STRIPE_SECRET_KEY",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
]) {
  if (!cloudRunDeploy.includes(`${stripeSecret}=greyhoundiq-$env_name-${stripeSecret}:latest`)) {
    findings.push(`cloud-run-deploy.yml: missing ${stripeSecret} secret mapping`);
  }
}
if (!cloudRunDeploy.includes("STRIPE_APP_URL=$nextauth_url")) {
  findings.push("cloud-run-deploy.yml: STRIPE_APP_URL must follow NEXTAUTH_URL");
}
for (const publicSupabaseSecret of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!cloudRunDeploy.includes(`${publicSupabaseSecret}=greyhoundiq-$env_name-${publicSupabaseSecret}:latest`)) {
    findings.push(`cloud-run-deploy.yml: missing ${publicSupabaseSecret} runtime secret mapping`);
  }
}

const cloudRunDeployPs1 = readFileSync(
  join(root, "scripts", "gcp-cloud-run-deploy.ps1"),
  "utf8",
);
if (!cloudRunDeployPs1.includes('[int]$WebConcurrency = 20')) {
  findings.push("gcp-cloud-run-deploy.ps1: web concurrency must stay at the tuned value");
}
if (!cloudRunDeployPs1.includes('"--cpu-boost"')) {
  findings.push("gcp-cloud-run-deploy.ps1: startup CPU boost must stay enabled");
}
if (!cloudRunDeployPs1.includes('$minInstances = "3"')) {
  findings.push("gcp-cloud-run-deploy.ps1: web min instances must stay at the tuned value");
}
if (!cloudRunDeployPs1.includes('$scannerRequiredSecrets = @("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY")')) {
  findings.push("gcp-cloud-run-deploy.ps1: missing scanner Supabase secret preflight");
}
if (
  !cloudRunDeployPs1.includes(
    '$scannerServiceAccount = "giq-media-scanner-$Environment@$ProjectId.iam.gserviceaccount.com"'
  ) ||
  !cloudRunDeployPs1.includes('"--service-account=$scannerServiceAccount"')
) {
  findings.push("gcp-cloud-run-deploy.ps1: scanner must retain its dedicated service account");
}
if (!cloudRunDeployPs1.includes('$NextPublicSupabaseUrl = Required-Value $NextPublicSupabaseUrl "NEXT_PUBLIC_SUPABASE_URL"')) {
  findings.push("gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_URL must be required");
}
if (!cloudRunDeployPs1.includes('$NextPublicSupabaseAnonKey = Required-Value $NextPublicSupabaseAnonKey "NEXT_PUBLIC_SUPABASE_ANON_KEY"')) {
  findings.push("gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_ANON_KEY must be required");
}
const deployRequiredSecretsBlock =
  cloudRunDeployPs1.match(/\$requiredSecrets = @\([\s\S]*?\)/)?.[0] ?? "";
for (const supabaseSecret of [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_JWT_SECRET",
]) {
  if (!deployRequiredSecretsBlock.includes(`"${supabaseSecret}"`)) {
    findings.push(`gcp-cloud-run-deploy.ps1: ${supabaseSecret} must be a required web secret`);
  }
}
for (const publicSupabaseSecret of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!deployRequiredSecretsBlock.includes(`"${publicSupabaseSecret}"`)) {
    findings.push(`gcp-cloud-run-deploy.ps1: ${publicSupabaseSecret} must be a required web secret`);
  }
}
if (cloudRunDeployPs1.includes('$plainEnvItems += "NEXT_PUBLIC_SUPABASE_URL=$NextPublicSupabaseUrl"')) {
  findings.push("gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_URL runtime value must use Secret Manager");
}
if (cloudRunDeployPs1.includes('$plainEnvItems += "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NextPublicSupabaseAnonKey"')) {
  findings.push("gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_ANON_KEY runtime value must use Secret Manager");
}

const cloudRunBootstrapPs1 = readFileSync(
  join(root, "scripts", "gcp-cloud-run-bootstrap.ps1"),
  "utf8",
);
if (!cloudRunBootstrapPs1.includes("--public-access-prevention")) {
  findings.push("gcp-cloud-run-bootstrap.ps1: GCS buckets must enforce public access prevention");
}
for (const publicSupabaseSecret of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!cloudRunBootstrapPs1.includes(`"${publicSupabaseSecret}"`)) {
    findings.push(`gcp-cloud-run-bootstrap.ps1: must create ${publicSupabaseSecret} secret shell`);
  }
}

const cloudRunBootstrapSh = readFileSync(
  join(root, "scripts", "gcp-cloud-run-bootstrap.sh"),
  "utf8",
);
for (const publicSupabaseSecret of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) {
  if (!cloudRunBootstrapSh.includes(publicSupabaseSecret)) {
    findings.push(`gcp-cloud-run-bootstrap.sh: must create ${publicSupabaseSecret} secret shell`);
  }
}

const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
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
