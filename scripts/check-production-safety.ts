import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const workflowDir = join(root, ".github", "workflows");
const workflows = readdirSync(workflowDir)
  .filter((file) => /\.(ya?ml)$/i.test(file))
  .map((file) => ({
    file,
    text: readFileSync(join(workflowDir, file), "utf8"),
  }));

const findings: string[] = [];
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
for (const requiredEnv of ["LAGO_API_URL", "LAGO_FRONT_URL", "LAGO_API_KEY", "LAGO_WEBHOOK_SECRET"]) {
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
if (!cloudRunDeploy.includes("for secret_name in SUPABASE_URL SUPABASE_SERVICE_ROLE_KEY NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY")) {
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
if (!cloudRunDeployPs1.includes('$NextPublicSupabaseUrl = Required-Value $NextPublicSupabaseUrl "NEXT_PUBLIC_SUPABASE_URL"')) {
  findings.push("gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_URL must be required");
}
if (!cloudRunDeployPs1.includes('$NextPublicSupabaseAnonKey = Required-Value $NextPublicSupabaseAnonKey "NEXT_PUBLIC_SUPABASE_ANON_KEY"')) {
  findings.push("gcp-cloud-run-deploy.ps1: NEXT_PUBLIC_SUPABASE_ANON_KEY must be required");
}
const deployRequiredSecretsBlock =
  cloudRunDeployPs1.match(/\$requiredSecrets = @\([\s\S]*?\)/)?.[0] ?? "";
for (const supabaseSecret of ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
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
