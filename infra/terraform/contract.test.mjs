import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(directory, "../..");
const read = (path) => readFileSync(join(directory, path), "utf8");
const terraformFiles = readdirSync(directory)
  .filter((path) => path.endsWith(".tf"))
  .sort();
const terraform = terraformFiles.map(read).join("\n");
const main = read("main.tf");
const edge = read("edge.tf");
const deferredContracts = read("deferred-contracts.tf");
const outputs = read("outputs.tf");
const variables = read("variables.tf");
const versions = read("versions.tf");
const readme = read("README.md");
const architecturePlan = readFileSync(
  join(repositoryRoot, "src/components/design-lab-architecture-plan.ts"),
  "utf8",
);
const rootAgents = readFileSync(join(repositoryRoot, "AGENTS.md"), "utf8");
const gitignore = readFileSync(join(repositoryRoot, ".gitignore"), "utf8");
const packageJson = readFileSync(join(repositoryRoot, "package.json"), "utf8");
const ciWorkflow = readFileSync(
  join(repositoryRoot, ".github/workflows/ci.yml"),
  "utf8",
);
const providerLock = read(".terraform.lock.hcl");
const livenessRoute = readFileSync(
  join(repositoryRoot, "src/app/api/health/route.ts"),
  "utf8",
);
const readinessRoute = readFileSync(
  join(repositoryRoot, "src/app/api/health/ready/route.ts"),
  "utf8",
);
const aggregateSource = readFileSync(
  join(repositoryRoot, "src/lib/live/sync.ts"),
  "utf8",
);
const schedulerSource = readFileSync(
  join(repositoryRoot, "scripts/gcp-scheduler-sync.sh"),
  "utf8",
);

assert.deepEqual(
  [...new Set(terraform.match(/australia-[a-z]+\d/g) ?? [])].sort(),
  ["australia-southeast1", "australia-southeast2"],
  "Terraform compute regions must remain Sydney and Melbourne only.",
);
assert.match(versions, /backend "gcs"\s*\{[\s\S]*?prefix\s*=\s*"greyhoundiq\/staging\/green"/);
assert.doesNotMatch(versions, /backend "gcs"\s*\{[\s\S]*?\bbucket\s*=/);
assert.match(variables, /variable "green_project_id"[\s\S]*?nullable\s*=\s*false/);
assert.match(variables, /variable "blue_project_id"[\s\S]*?nullable\s*=\s*false/);
assert.doesNotMatch(terraform, /\bvar\.project_id\b/);
assert.match(main, /name_prefix\s*=\s*"greyhoundiq-staging-green"/);
assert.match(main, /identity_prefix\s*=\s*"giq-stg-green"/);
assert.match(main, /state_prefix\s*=\s*"greyhoundiq\/staging\/green"/);
assert.match(main, /condition\s*=\s*var\.green_project_id != var\.blue_project_id/);
assert.match(outputs, /output "green_deployment_boundary"/);
assert.match(outputs, /project_id\s*=\s*var\.green_project_id/);
assert.match(outputs, /state_prefix\s*=\s*local\.state_prefix/);
assert.doesNotMatch(terraform, /^\s*(?:import|moved)\s*\{/m);
assert.doesNotMatch(terraform, /provider\s*=\s*google(?:-beta)?\.blue/);
assert.doesNotMatch(terraform, /data\s+"google_[^"]+"\s+"blue/);
for (const match of terraform.matchAll(/^\s*project\s*=\s*([^\r\n]+)/gm)) {
  assert.equal(
    match[1].trim(),
    "var.green_project_id",
    `Every managed Google resource must stay in green_project_id: ${match[0].trim()}`,
  );
}
assert.match(main, /for_each\s*=\s*local\.regions/);
assert.match(main, /resource "google_cloud_run_v2_service" "app"/);
assert.match(variables, /@sha256:\[0-9a-f\]\{64\}\$/);
assert.match(main, /image\s*=\s*var\.image_digest_uri/);
assert.doesNotMatch(terraform, /:latest\b/i);
assert.match(variables, /variable "source_repository_label"[\s\S]*?nullable\s*=\s*false/);
assert.match(variables, /variable "source_revision"[\s\S]*?\^\[0-9a-f\]\{40\}\$/);
for (const [label, value] of [
  ["deployment_slot", "local.deployment_slot"],
  ["source_repository", "var.source_repository_label"],
  ["source_revision", "var.source_revision"],
]) {
  assert.match(main, new RegExp(`${label}\\s*=\\s*${value.replaceAll(".", "\\.")}`));
}
assert.ok(
  (main.match(/labels\s*=\s*local\.labels/g) ?? []).length >= 2,
  "Cloud Run service and revision must both carry immutable provenance labels.",
);
for (const provider of ["hashicorp/google", "hashicorp/google-beta"]) {
  assert.match(
    providerLock,
    new RegExp(`provider "registry\\.terraform\\.io/${provider}"[\\s\\S]*?version\\s*=\\s*"7\\.24\\.0"`),
  );
}
assert.ok(
  (providerLock.match(/"h1:[^"]+"/g) ?? []).length >= 4,
  "Provider lock must retain signed package checksums for Linux and Windows review.",
);

assert.match(main, /ingress\s*=\s*"INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"/);
assert.match(main, /invoker_iam_disabled\s*=\s*true/);
assert.match(main, /default_uri_disabled\s*=\s*true/);
assert.match(main, /launch_stage\s*=\s*"BETA"/);
assert.match(main, /deletion_protection\s*=\s*var\.deletion_protection/);
assert.match(
  variables,
  /variable "deletion_protection"[\s\S]*?default\s*=\s*true/,
);

const appServiceStart = main.indexOf(
  'resource "google_cloud_run_v2_service" "app"',
);
const appTemplateStart = main.indexOf("\n  template {", appServiceStart);
const appContainersStart = main.indexOf("\n    containers {", appTemplateStart);
assert.ok(
  appServiceStart >= 0 &&
    appTemplateStart > appServiceStart &&
    appContainersStart > appTemplateStart,
);
assert.match(
  main.slice(appServiceStart, appTemplateStart),
  /scaling\s*\{[\s\S]*?min_instance_count[\s\S]*?max_instance_count[\s\S]*?scaling_mode\s*=\s*"AUTOMATIC"/,
);
assert.doesNotMatch(
  main.slice(appTemplateStart, appContainersStart),
  /\bscaling\s*\{/,
);

for (const [field, value] of [
  ["concurrency", 20],
  ["min_instances", 3],
  ["max_instances", 10],
  ["request_timeout_seconds", 900],
]) {
  assert.match(main, new RegExp(`${field}\\s*=\\s*${value}\\b`));
}
assert.match(main, /cpu\s*=\s*"2"/);
assert.match(main, /memory\s*=\s*"4Gi"/);
const minInstances = Number(main.match(/min_instances\s*=\s*(\d+)/)?.[1]);
const maxInstances = Number(main.match(/max_instances\s*=\s*(\d+)/)?.[1]);
const regionCount = new Set(main.match(/australia-[a-z]+\d/g) ?? []).size;
assert.ok(
  minInstances <= maxInstances,
  "Selected minimum instances must not exceed maximum instances.",
);
assert.ok(
  maxInstances * regionCount <= 20,
  "Selected combined regional service cap must remain bounded at 20 instances.",
);

assert.match(main, /startup[\s\S]*?path\s*=\s*"\/api\/health\/ready"/);
assert.match(main, /liveness[\s\S]*?path\s*=\s*"\/api\/health"/);
assert.match(main, /startup_probe\s*\{[\s\S]*?http_get\s*\{[\s\S]*?local\.health_probes\.startup\.path/);
assert.match(main, /liveness_probe\s*\{[\s\S]*?http_get\s*\{[\s\S]*?local\.health_probes\.liveness\.path/);
assert.match(livenessRoute, /status:\s*"ok"/);
assert.match(readinessRoute, /status:\s*"not_ready"/);
assert.match(readinessRoute, /status:\s*503/);
assert.match(readinessRoute, /withDbSystemContext/);

assert.match(main, /aggregate_application_seconds\s*=\s*780\b/);
assert.match(main, /scheduler_attempt_seconds\s*=\s*840\b/);
assert.match(main, /request_timeout_seconds\s*=\s*900\b/);
assert.match(main, /aggregate_application_seconds < local\.timeout_budget\.scheduler_attempt_seconds/);
assert.match(main, /scheduler_attempt_seconds < local\.timeout_budget\.cloud_run_request_seconds/);
assert.match(aggregateSource, /AGGREGATE_MAINTENANCE_BUDGET_MS\s*=\s*780_000/);
assert.equal(
  (schedulerSource.match(/aggregate-refresh[^\r\n]*"840s"/g) ?? []).length,
  2,
  "Both existing blue and staging aggregate Scheduler calls must preserve the 840-second deadline contract.",
);
assert.match(outputs, /output "timeout_budget_contract"/);

assert.match(edge, /network_endpoint_type\s*=\s*"SERVERLESS"/);
assert.match(edge, /load_balancing_scheme\s*=\s*"EXTERNAL_MANAGED"/);
assert.match(edge, /network_tier\s*=\s*"PREMIUM"/);
assert.match(edge, /port_range\s*=\s*"443"/);
assert.match(edge, /address_type\s*=\s*"EXTERNAL"/);
assert.match(edge, /ip_version\s*=\s*"IPV4"/);
assert.match(edge, /outlier_detection\s*\{/);
assert.doesNotMatch(edge, /balancing_mode\s*=/);
assert.doesNotMatch(edge, /health_check(?:s)?\s*=/);
assert.doesNotMatch(edge, /timeout_sec\s*=/);

assert.match(edge, /type\s*=\s*"CLOUD_ARMOR_EDGE"/);
assert.match(edge, /type\s*=\s*"CLOUD_ARMOR"/);
assert.match(edge, /origin\.region_code != 'AU'/);
assert.match(edge, /request\.method == 'POST'/);
assert.match(edge, /evaluatePreconfiguredWaf\('sqli-v422-stable'\)/);
assert.match(edge, /evaluatePreconfiguredWaf\('xss-v422-stable'\)/);
assert.match(edge, /action\s*=\s*"throttle"/);
assert.match(edge, /exceed_action\s*=\s*"deny\(429\)"/);
assert.match(edge, /requests\s*=\s*300\b/);
assert.match(edge, /interval_sec\s*=\s*60\b/);
assert.ok(
  (edge.match(/preview\s*=\s*true/g) ?? []).length >= 5,
  "Every candidate geo, provider, WAF, and rate rule must remain preview-only.",
);
const providerPaths = [...edge.matchAll(/^\s+"\d+"\s*=\s*"([^"]+)"/gm)].map(
  ([, path]) => path,
);
for (const [, description] of edge.matchAll(
  /^ {4}(?: {2})?description\s*=\s*"([^"]+)"/gm,
)) {
  const renderedDescriptions = description.includes("${rule.value}")
    ? providerPaths.map((path) => description.replace("${rule.value}", path))
    : [description];
  for (const rendered of renderedDescriptions) {
    assert.ok(
      rendered.length <= 64,
      `Cloud Armor rule description exceeds 64 characters: ${rendered}`,
    );
  }
}

assert.match(edge, /enable_cdn\s*=\s*false/);
assert.doesNotMatch(terraform, /FORCE_CACHE_ALL/);
assert.match(
  edge,
  /resource "google_compute_managed_ssl_certificate" "frontend"/,
);
assert.match(edge, /resource "google_dns_record_set" "frontend"/);
assert.match(edge, /dns_managed_zone_name == null \? 0 : 1/);
assert.match(edge, /min_tls_version\s*=\s*"TLS_1_2"/);

for (const service of [
  "artifactregistry.googleapis.com",
  "cloudresourcemanager.googleapis.com",
  "compute.googleapis.com",
  "dns.googleapis.com",
  "iam.googleapis.com",
  "iamcredentials.googleapis.com",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "run.googleapis.com",
  "secretmanager.googleapis.com",
  "serviceusage.googleapis.com",
  "sts.googleapis.com",
]) {
  assert.match(main, new RegExp(service.replaceAll(".", "\\.")));
}

const projectVariable = variables.slice(
  variables.indexOf('variable "green_project_id"'),
  variables.indexOf('variable "image_digest_uri"'),
);
assert.doesNotMatch(projectVariable, /\bdefault\s*=/);
assert.doesNotMatch(terraform, /google_service_account_key/);
assert.doesNotMatch(
  terraform,
  /roles\/(?:owner|editor|iam\.serviceAccountKeyAdmin)/,
);
assert.doesNotMatch(terraform, /\b(?:private_key|credentials)\s*=/i);
const projectIamStart = main.indexOf(
  'resource "google_project_iam_member" "deployer_project_roles"',
);
const projectIamEnd = main.indexOf('\nresource "', projectIamStart + 1);
assert.ok(projectIamStart >= 0 && projectIamEnd > projectIamStart);
assert.doesNotMatch(
  main.slice(projectIamStart, projectIamEnd),
  /google_service_account\.runtime\.email/,
);
assert.match(main, /role\s*=\s*"roles\/iam\.serviceAccountUser"/);
assert.match(
  main,
  /service_account_id\s*=\s*google_service_account\.runtime\.name/,
);

assert.match(variables, /variable "wif_deployer_principal_set"/);
assert.ok(
  variables.includes("attribute\\\\.repository/"),
  "WIF input must be restricted to a repository attribute principalSet.",
);
assert.match(main, /resource "google_service_account_iam_member" "wif_can_impersonate_deployer"/);
assert.match(main, /role\s*=\s*"roles\/iam\.workloadIdentityUser"/);
assert.match(main, /member\s*=\s*var\.wif_deployer_principal_set/);

assert.match(variables, /variable "runtime_config"[\s\S]*?type\s*=\s*map\(string\)/);
assert.match(variables, /runtime_config[\s\S]*?SECRET\|PASSWORD\|TOKEN\|PRIVATE_KEY\|CREDENTIAL\|DATABASE_URL\|DSN/);
assert.match(variables, /variable "runtime_secret_references"[\s\S]*?secret_id\s*=\s*string[\s\S]*?version\s*=\s*string/);
assert.match(variables, /runtime_secret_references[\s\S]*?\^\[1-9\]\[0-9\]\*\$/);
assert.match(main, /dynamic "env"\s*\{[\s\S]*?for_each\s*=\s*var\.runtime_config/);
assert.match(main, /dynamic "env"\s*\{[\s\S]*?for_each\s*=\s*var\.runtime_secret_references/);
assert.match(main, /value_source\s*\{[\s\S]*?secret_key_ref\s*\{[\s\S]*?secret\s*=\s*runtime_secret\.value\.secret_id[\s\S]*?version\s*=\s*runtime_secret\.value\.version/);
assert.match(main, /resource "google_secret_manager_secret_iam_member" "runtime"/);
assert.match(main, /role\s*=\s*"roles\/secretmanager\.secretAccessor"/);
assert.doesNotMatch(terraform, /\bsecret_data\s*=|\bsecret_value\s*=/i);
assert.doesNotMatch(terraform, /version\s*=\s*"latest"/i);
assert.match(main, /reserved_runtime_config_names/);
assert.match(main, /setintersection\(toset\(keys\(var\.runtime_config\)\), toset\(keys\(var\.runtime_secret_references\)\)\)/);

assert.doesNotMatch(
  terraform,
  /resource "google_(?:alloydb|sql|storage_bucket|pubsub|cloud_tasks)/,
);
assert.doesNotMatch(terraform, /resource "google_secret_manager_secret"\s/);
for (const service of ["alloydb", "espv2", "cdn", "queues", "observability"]) {
  assert.match(
    deferredContracts,
    new RegExp(`${service}\\s*=\\s*\\{[\\s\\S]*?provisioned\\s*=\\s*false[\\s\\S]*?release_gate\\s*=\\s*"blocked"`),
  );
}
assert.match(deferredContracts, /check "managed_services_remain_deferred"/);
assert.match(deferredContracts, /alltrue\(\[/);
assert.match(outputs, /output "deferred_managed_service_contracts"/);
assert.match(readme, /Do not apply from this repository state/);
assert.match(readme, /terraform destroy.*never rollback/i);
assert.match(readme, /source-validated; not planned, applied, or live-verified/i);
assert.match(readme, /Terraform 1\.14\.5/);
assert.match(readme, /backend disabled/i);
assert.match(readme, /Linux AMD64 CI and Windows AMD64 review/i);
assert.match(
  packageJson,
  /"check:terraform-source": "node infra\/terraform\/contract\.test\.mjs && node infra\/terraform\/private-datastore-policy\.test\.mjs && node infra\/terraform-production\/contract\.test\.mjs"/,
);
assert.match(ciWorkflow, /npm run check:terraform-source/);
assert.match(ciWorkflow, /source=\$PWD\/infra\/terraform-production/);
assert.match(
  ciWorkflow,
  /hashicorp\/terraform@sha256:96d2bc440714bf2b2f2998ac730fd4612f30746df43fca6f0892b2e2035b11bc/,
);
assert.match(ciWorkflow, /terraform init -backend=false -lockfile=readonly/);
assert.match(readme, /does not import or manage the existing load balancer/i);
assert.match(readme, /does not import, read, rename, replace, or manage existing blue\/live resources/i);
assert.match(readme, /fixed `greyhoundiq\/staging\/green` remote-state prefix/i);
assert.match(readme, /must not be the blue\/live state bucket/i);
assert.match(readme, /cannot pass `\/api\/health\/ready` until every required reviewed secret reference/i);
assert.match(readme, /secret values never enter Terraform or state/i);
assert.match(readme, /55\/55|release_gate = "blocked"/i);
assert.match(
  readme,
  /current candidate rollout and smoke checks use tagged `run\.app` URLs/i,
);
assert.match(readme, /one Sydney Supabase\/PostgreSQL data plane/i);
assert.match(readme, /not database failover or active-active resilience/i);
assert.match(readme, /roles-permissions\/compute/);
assert.match(readme, /roles-permissions\/run/);
assert.match(readme, /dns\/docs\/access-control/);
assert.match(rootAgents, /infra\/terraform\/AGENTS\.md/);
for (const ignored of [
  "**/.terraform/*",
  "*.tfstate",
  "*.tfplan",
  "*.tfvars",
  "*.tfvars.json",
  ".terraformrc",
  "terraform.rc",
]) {
  assert.ok(
    gitignore.includes(ignored),
    `Missing Terraform ignore: ${ignored}`,
  );
}

const phaseOneStart = architecturePlan.indexOf('id: "ARCH.P1"');
const phaseTwoStart = architecturePlan.indexOf('id: "ARCH.P2"');
assert.ok(phaseOneStart >= 0 && phaseTwoStart > phaseOneStart);
const phaseOne = architecturePlan.slice(phaseOneStart, phaseTwoStart);
const statuses = new Map(
  [...phaseOne.matchAll(/id: "(ARCH-10\d)"[\s\S]*?status: "([^"]+)"/g)].map(
    ([, id, status]) => [id, status],
  ),
);
assert.deepEqual(Object.fromEntries(statuses), {
  "ARCH-101": "in-progress",
  "ARCH-102": "in-progress",
  "ARCH-103": "in-progress",
  "ARCH-104": "in-progress",
  "ARCH-105": "in-progress",
  "ARCH-106": "planned",
  "ARCH-107": "in-progress",
  "ARCH-108": "planned",
});

console.log(
  `Terraform source contract passed (${terraformFiles.length} Terraform files; no cloud access).`,
);
