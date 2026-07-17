import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildProviderReadinessEvidence,
  extractWorkflowNames,
  renderProviderReadinessMarkdown,
  stableJson,
  type DiscoveryError,
} from "./gcp-provider-readiness";
import {
  parseProbeJson,
  ReadOnlyProbeRunner,
} from "./gcp-provider-readiness-command";
import { discoverGcpProject } from "./gcp-provider-readiness-gcp";
import {
  discoverGithubEnvironment,
  parseGithubRepository,
} from "./gcp-provider-readiness-github";

type ArchitectureConfig = {
  selectedTarget: {
    regions: Array<{ id: string }>;
    ingress: string;
    defaultUrlPolicy: string;
  };
};

function main() {
  const runner = new ReadOnlyProbeRunner();
  const architecture = readJsonFile<ArchitectureConfig>(
    "config",
    "gcp-architecture.json",
  );
  const workflowSource = readFileSync(
    join(process.cwd(), ".github", "workflows", "cloud-run-deploy.yml"),
    "utf8",
  );
  const regions = architecture.selectedTarget.regions.map((region) => region.id);

  const repository = resolveRepository(runner);
  const environmentName = readStringArg("--github-environment") ?? "staging";
  const blueProject = resolveBlueProject(runner);
  const greenProject = validateProjectId(
    readStringArg("--green-project"),
    "--green-project",
    false,
  );

  const authErrors: DiscoveryError[] = [];
  const auth = parseProbeJson<Array<{ account?: string }>>(
    runner.run({
      tool: "gcloud",
      args: ["auth", "list", "--filter=status:ACTIVE", "--format=json(account)"],
      operation: "gcp.auth.active-account",
    }),
    "gcp.auth.active-account",
    authErrors,
  );
  const sourceSha = runner.run({
    tool: "git",
    args: ["rev-parse", "HEAD"],
    operation: "git.source-sha",
  });
  const sourceStatus = runner.run({
    tool: "git",
    args: ["status", "--porcelain"],
    operation: "git.source-status",
  });

  const blue = discoverGcpProject(
    runner,
    blueProject,
    regions,
    repository,
    false,
  );
  const green = greenProject
    ? discoverGcpProject(runner, greenProject, regions, repository, true)
    : null;
  const github = discoverGithubEnvironment(
    runner,
    repository,
    environmentName,
    extractWorkflowNames(workflowSource, "secrets"),
    extractWorkflowNames(workflowSource, "vars"),
  );
  const evidence = buildProviderReadinessEvidence({
    capturedAt: requireIsoTimestamp(readStringArg("--captured-at")),
    sourceSha: sourceSha.ok ? sourceSha.stdout : "not-verified",
    sourceDirty: !sourceStatus.ok || Boolean(sourceStatus.stdout),
    activeAccount: auth?.[0]?.account ?? null,
    targetRegions: regions,
    targetIngress: architecture.selectedTarget.ingress,
    targetDefaultUrlPolicy: architecture.selectedTarget.defaultUrlPolicy,
    blue,
    green,
    github,
    commandAudit: runner.audit,
  });

  writeEvidenceUnlessDisabled(evidence);
  printSummary(evidence);
  if (process.argv.includes("--require-ready") && evidence.status !== "ready") {
    process.exitCode = 1;
  }
}

function resolveRepository(runner: ReadOnlyProbeRunner) {
  const remote = runner.run({
    tool: "git",
    args: ["remote", "get-url", "origin"],
    operation: "git.remote.origin",
  });
  return (
    readStringArg("--repository") ??
    (remote.ok ? parseGithubRepository(remote.stdout) : null)
  );
}

function resolveBlueProject(runner: ReadOnlyProbeRunner) {
  const activeProject = runner.run({
    tool: "gcloud",
    args: ["config", "get-value", "project"],
    operation: "gcp.config.active-project",
  });
  const candidate =
    readStringArg("--blue-project") ??
    (activeProject.ok ? activeProject.stdout : null);
  return validateProjectId(candidate, "--blue-project or active gcloud project", true);
}

function validateProjectId(
  value: string | null,
  source: string,
  required: true,
): string;
function validateProjectId(
  value: string | null,
  source: string,
  required: false,
): string | null;
function validateProjectId(
  value: string | null,
  source: string,
  required: boolean,
) {
  if (!value && !required) return null;
  if (!value || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(value)) {
    throw new Error(`${source} must resolve to a valid GCP project id`);
  }
  return value;
}

function writeEvidenceUnlessDisabled(
  evidence: ReturnType<typeof buildProviderReadinessEvidence>,
) {
  if (process.argv.includes("--no-write")) return;
  const outputDir =
    readStringArg("--output-dir") ??
    join(process.cwd(), "output", "gcp-provider-readiness");
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "latest.json"), stableJson(evidence), "utf8");
  writeFileSync(
    join(outputDir, "latest.md"),
    renderProviderReadinessMarkdown(evidence),
    "utf8",
  );
  console.log(`Evidence: ${join(outputDir, "latest.json")}`);
}

function printSummary(
  evidence: ReturnType<typeof buildProviderReadinessEvidence>,
) {
  console.log(`GCP provider-readiness preflight: ${evidence.status}`);
  console.log(`Blue project: ${evidence.blue.projectId ?? "not-verified"}`);
  console.log(`Blue billing enabled: ${String(evidence.blue.billingEnabled)}`);
  console.log(`Green project: ${evidence.green?.projectId ?? "not-configured"}`);
  console.log(`Blockers: ${evidence.blockerCount}`);
  for (const finding of evidence.findings) {
    console.log(`${finding.id} ${finding.severity}: ${finding.message}`);
  }
}

function readJsonFile<T>(...parts: string[]) {
  return JSON.parse(
    readFileSync(join(process.cwd(), ...parts), "utf8"),
  ) as T;
}

function readStringArg(name: string) {
  const prefix = `${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length).trim() || null;
  const index = process.argv.indexOf(name);
  if (index < 0) return null;
  return process.argv[index + 1]?.trim() || null;
}

function requireIsoTimestamp(value: string | null) {
  if (!value) return new Date().toISOString();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new Error("--captured-at must be an ISO-8601 UTC timestamp");
  }
  return value;
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("/check-gcp-provider-readiness.ts")
) {
  main();
}
