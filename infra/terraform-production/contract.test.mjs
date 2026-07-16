import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const directory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(directory, "../..");
const read = (path) => readFileSync(join(directory, path), "utf8");
const terraform = readdirSync(directory)
  .filter((path) => path.endsWith(".tf"))
  .sort()
  .map(read)
  .join("\n");
const main = read("main.tf");
const variables = read("variables.tf");
const versions = read("versions.tf");
const lock = read(".terraform.lock.hcl");
const rootAgents = readFileSync(join(repositoryRoot, "AGENTS.md"), "utf8");

assert.match(versions, /required_version\s*=\s*"= 1\.14\.5"/);
assert.match(versions, /version\s*=\s*"= 7\.24\.0"/);
assert.match(lock, /provider "registry\.terraform\.io\/hashicorp\/google"[\s\S]*?version\s*=\s*"7\.24\.0"/);
assert.match(versions, /backend "gcs"\s*\{[\s\S]*?prefix\s*=\s*"greyhoundiq\/production"/);
assert.doesNotMatch(versions, /backend "gcs"\s*\{[\s\S]*?\bbucket\s*=/);

assert.deepEqual(
  [...new Set(terraform.match(/australia-[a-z]+\d/g) ?? [])].sort(),
  ["australia-southeast1", "australia-southeast2"],
);

for (const name of [
  "production_project_id",
  "production_domain",
  "source_repository",
  "github_repository_id",
  "github_repository_owner_id",
  "source_revision",
  "image_digest_uri",
]) {
  const start = variables.indexOf(`variable "${name}"`);
  const end = variables.indexOf('\nvariable "', start + 1);
  const block = variables.slice(start, end < 0 ? undefined : end);
  assert.ok(start >= 0, `Missing required input ${name}.`);
  assert.match(block, /nullable\s*=\s*false/);
  assert.doesNotMatch(block, /\bdefault\s*=/);
}

assert.ok(variables.includes("-docker\\\\.pkg\\\\.dev/"));
assert.match(variables, /@sha256:\[0-9a-f\]\{64\}\$/);
assert.match(variables, /\^\[0-9a-f\]\{40\}\$/);
assert.match(variables, /variable "github_repository_id"[\s\S]*?\^\[1-9\]\[0-9\]\*\$/);
assert.match(variables, /variable "github_repository_owner_id"[\s\S]*?\^\[1-9\]\[0-9\]\*\$/);
assert.match(variables, /variable "runtime_secret_references"[\s\S]*?secret_id\s*=\s*string[\s\S]*?version\s*=\s*string/);
assert.match(variables, /runtime_secret_references[\s\S]*?\^\[1-9\]\[0-9\]\*\$/);
assert.doesNotMatch(terraform, /\bsecret_data\s*=|\bsecret_value\s*=|version\s*=\s*"latest"/i);
assert.doesNotMatch(variables, /\(\?[=!<]/, "Terraform validations must remain RE2-compatible.");

for (const service of [
  "alloydb.googleapis.com",
  "artifactregistry.googleapis.com",
  "cloudbuild.googleapis.com",
  "cloudkms.googleapis.com",
  "cloudtasks.googleapis.com",
  "cloudtrace.googleapis.com",
  "compute.googleapis.com",
  "dns.googleapis.com",
  "logging.googleapis.com",
  "monitoring.googleapis.com",
  "pubsub.googleapis.com",
  "redis.googleapis.com",
  "run.googleapis.com",
  "secretmanager.googleapis.com",
  "servicenetworking.googleapis.com",
  "storage.googleapis.com",
  "vpcaccess.googleapis.com",
]) {
  assert.ok(main.includes(service), `Missing required production API declaration: ${service}`);
}

const allowedResources = new Set([
  "google_iam_workload_identity_pool",
  "google_iam_workload_identity_pool_provider",
  "google_project_service",
  "google_project_iam_member",
  "google_service_account",
  "google_service_account_iam_member",
  "google_secret_manager_secret_iam_member",
]);
for (const [, resourceType] of terraform.matchAll(/resource "([^"]+)"/g)) {
  assert.ok(allowedResources.has(resourceType), `Paid or out-of-scope resource declared: ${resourceType}`);
}

assert.doesNotMatch(terraform, /google_service_account_key/);
assert.doesNotMatch(terraform, /roles\/(?:owner|editor|iam\.serviceAccountKeyAdmin)/);
const deployerRolesBlock = main.slice(
  main.indexOf("deployer_project_roles = toset(["),
  main.indexOf("runtime_secret_ids = toset(["),
);
assert.deepEqual(
  [...deployerRolesBlock.matchAll(/"(roles\/[^"]+)"/g)].map(([, role]) => role).sort(),
  ["roles/serviceusage.serviceUsageAdmin", "roles/serviceusage.serviceUsageConsumer"],
);
assert.match(main, /role\s*=\s*"roles\/iam\.workloadIdentityUser"/);
assert.match(main, /role\s*=\s*"roles\/iam\.serviceAccountUser"/);
assert.match(main, /role\s*=\s*"roles\/secretmanager\.secretAccessor"/);
assert.match(main, /resource "google_service_account" "build"/);
assert.match(main, /resource "google_service_account" "deployer"/);
assert.match(main, /resource "google_service_account" "runtime"/);
assert.match(main, /wif_can_impersonate_build/);
assert.match(main, /wif_can_impersonate_deployer/);
assert.match(main, /workload_identity_pool_id\s*=\s*"greyhoundiq-prod"/);
assert.match(main, /workload_identity_pool_provider_id\s*=\s*"github-prod"/);
assert.match(main, /"google\.subject"\s*=\s*"assertion\.sub"/);
assert.match(main, /"attribute\.repository_id"\s*=\s*"assertion\.repository_id"/);
assert.match(main, /assertion\.repository == '\$\{var\.source_repository\}'/);
assert.match(main, /assertion\.repository_id == '\$\{var\.github_repository_id\}'/);
assert.match(main, /assertion\.repository_owner_id == '\$\{var\.github_repository_owner_id\}'/);
assert.match(main, /assertion\.sub\.endsWith\(':environment:prod'\)/);
assert.equal((main.match(/attribute\.repository_id\/\$\{var\.github_repository_id\}/g) ?? []).length, 2);
assert.match(main, /image_belongs_to_production_project/);
assert.doesNotMatch(terraform, /google_billing|billing_account|:latest\b/i);
assert.match(rootAgents, /infra\/terraform-production\/AGENTS\.md/);

console.log("Production Terraform foundation contract passed (source only; no cloud access).");
