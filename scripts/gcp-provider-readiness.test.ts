import assert from "node:assert/strict";

import {
  assertReadOnlyDiscoveryCommand,
  normalizeProbeError,
} from "./gcp-provider-readiness-command";
import {
  EXISTING_RELEASE_GATES,
  REQUIRED_GREEN_APIS,
  buildProviderReadinessEvidence,
  extractWorkflowNames,
  redactIdentity,
  renderProviderReadinessMarkdown,
  stableJson,
  type GithubSnapshot,
  type ProjectSnapshot,
  type ProviderReadinessInput,
} from "./gcp-provider-readiness";

function project(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    projectId: "greyhoundiq-blue-test",
    exists: true,
    lifecycleState: "ACTIVE",
    billingEnabled: true,
    enabledApis: [...REQUIRED_GREEN_APIS],
    cloudRunServices: [],
    iam: {
      policyVerified: true,
      publicRoleBindings: [],
      primitiveRoleBindings: [],
      memberTypeCounts: { serviceAccount: 3 },
      serviceAccountCount: 3,
      userManagedKeyCount: 0,
      distinctBuildDeployRuntimeAccounts: true,
    },
    wif: {
      discoveryVerified: true,
      poolCount: 1,
      providerCount: 1,
      repositoryBoundProvider: true,
    },
    quotas: {
      capacityBaselineApproved: true,
      regionalDiscovery: {
        "australia-southeast1": true,
        "australia-southeast2": true,
      },
      globalDiscoveryVerified: true,
    },
    discoveryErrors: [],
    ...overrides,
  };
}

function github(overrides: Partial<GithubSnapshot> = {}): GithubSnapshot {
  return {
    repository: "AIKICKSTART/Greyhound-IQ",
    environmentName: "staging",
    discoveryVerified: true,
    environmentExists: true,
    canAdminsBypass: false,
    protectionRuleCount: 1,
    requiredSecretNames: ["GCP_PROJECT_ID", "GCP_WIF_PROVIDER"],
    presentSecretNames: ["GCP_PROJECT_ID", "GCP_WIF_PROVIDER"],
    optionalVariableNames: ["ACTOR_CONVERSATION_MULTIPLEX_ENABLED"],
    presentVariableNames: ["ACTOR_CONVERSATION_MULTIPLEX_ENABLED"],
    discoveryErrors: [],
    ...overrides,
  };
}

function input(overrides: Partial<ProviderReadinessInput> = {}): ProviderReadinessInput {
  return {
    capturedAt: "2026-07-15T01:00:00.000Z",
    sourceSha: "a".repeat(40),
    sourceDirty: false,
    activeAccount: "daniel.fleuren@example.com",
    targetRegions: ["australia-southeast1", "australia-southeast2"],
    targetIngress: "internal-and-cloud-load-balancing",
    targetDefaultUrlPolicy: "disabled",
    blue: project(),
    green: project({ projectId: "greyhoundiq-green-test" }),
    github: github(),
    commandAudit: [
      {
        tool: "gcloud",
        operation: "gcp.project.describe.greyhoundiq-blue-test",
        ok: true,
        errorCode: null,
      },
    ],
    ...overrides,
  };
}

const ready = buildProviderReadinessEvidence(input());
assert.equal(ready.status, "ready");
assert.equal(ready.blockerCount, 0);
assert.equal(ready.preflightControl.mutationsExecuted, 0);
assert.equal(ready.preflightControl.productionTrafficProbesExecuted, 0);
assert.equal(ready.preflightControl.secretValuesRead, 0);
assert.equal(ready.identity.activeAccount, "d***@example.com");
for (const gate of EXISTING_RELEASE_GATES) {
  assert.equal(ready.releaseGateClaims[gate], "not-verified");
}

const blocked = buildProviderReadinessEvidence(
  input({
    blue: project({
      billingEnabled: false,
      cloudRunServices: [
        {
          name: "greyhoundiq-web-staging",
          environment: "staging",
          region: "australia-southeast1",
          url: "https://greyhoundiq-web-staging.example.run.app",
          ingress: "all",
          defaultUrlEnabled: true,
          publicInvocation: true,
          minScale: 3,
          maxScale: 10,
          concurrency: 20,
          cpu: "2",
          memory: "4Gi",
        },
        {
          name: "greyhoundiq-web-prod",
          environment: "prod",
          region: "australia-southeast1",
          url: "https://greyhoundiq-web-prod.example.run.app",
          ingress: "all",
          defaultUrlEnabled: true,
          publicInvocation: true,
          minScale: 3,
          maxScale: 10,
          concurrency: 20,
          cpu: "2",
          memory: "4Gi",
        },
      ],
    }),
    green: null,
    github: github({
      canAdminsBypass: true,
      protectionRuleCount: 0,
      presentSecretNames: [],
      presentVariableNames: [],
    }),
  }),
);
assert.equal(blocked.status, "blocked");
for (const findingId of [
  "GCP-BLUE-001",
  "GCP-BLUE-002",
  "GCP-BLUE-003",
  "GCP-GREEN-001",
  "GCP-GREEN-005",
  "GCP-QUOTA-001",
  "GCP-IAM-001",
  "GCP-WIF-001",
  "GH-ENV-002",
  "GH-ENV-003",
  "GH-ENV-004",
]) {
  assert.ok(blocked.findings.some((finding) => finding.id === findingId), findingId);
}
assert.deepEqual(blocked.github.missingSecretNames, [
  "GCP_PROJECT_ID",
  "GCP_WIF_PROVIDER",
]);

const markdown = renderProviderReadinessMarkdown(blocked);
assert.match(markdown, /zero cloud mutations/);
assert.match(markdown, /PREPROD\.GCP\.MANAGED_SERVICE_PARITY.*not-verified/);
assert.doesNotMatch(markdown, /daniel\.fleuren@example\.com/);
assert.doesNotMatch(stableJson(blocked), /daniel\.fleuren@example\.com/);

assert.deepEqual(
  extractWorkflowNames(
    "${{ secrets.GCP_PROJECT_ID }} ${{ secrets.GCP_WIF_PROVIDER }} ${{ secrets.GCP_PROJECT_ID }}",
    "secrets",
  ),
  ["GCP_PROJECT_ID", "GCP_WIF_PROVIDER"],
);
assert.deepEqual(
  extractWorkflowNames("${{ vars.WORKOS_COOKIE_DOMAIN }}", "vars"),
  ["WORKOS_COOKIE_DOMAIN"],
);
assert.equal(redactIdentity("daniel.fleuren@example.com"), "d***@example.com");
assert.equal(redactIdentity("service-account"), "[redacted]");
assert.equal(redactIdentity(null), null);

for (const command of [
  {
    tool: "gcloud" as const,
    args: ["projects", "describe", "greyhoundiq-test", "--format=json"],
    operation: "project.describe",
  },
  {
    tool: "gcloud" as const,
    args: ["run", "services", "list", "--project=greyhoundiq-test"],
    operation: "run.list",
  },
  {
    tool: "gh" as const,
    args: ["api", "repos/AIKICKSTART/Greyhound-IQ/environments"],
    operation: "github.environments",
  },
  {
    tool: "git" as const,
    args: ["status", "--porcelain"],
    operation: "git.status",
  },
]) {
  assert.doesNotThrow(() => assertReadOnlyDiscoveryCommand(command));
}

for (const command of [
  {
    tool: "gcloud" as const,
    args: ["run", "deploy", "greyhoundiq-web"],
    operation: "run.deploy",
  },
  {
    tool: "gcloud" as const,
    args: ["services", "enable", "run.googleapis.com"],
    operation: "services.enable",
  },
  {
    tool: "gh" as const,
    args: ["api", "repos/AIKICKSTART/Greyhound-IQ/environments", "-X", "PATCH"],
    operation: "github.patch",
  },
  {
    tool: "git" as const,
    args: ["push"],
    operation: "git.push",
  },
]) {
  assert.throws(() => assertReadOnlyDiscoveryCommand(command));
}

assert.equal(normalizeProbeError("reason: BILLING_DISABLED"), "BILLING_DISABLED");
assert.equal(normalizeProbeError("API Example API not enabled"), "SERVICE_DISABLED");
assert.equal(normalizeProbeError("PERMISSION_DENIED"), "PERMISSION_DENIED");
assert.equal(normalizeProbeError("HTTP 404: Not Found"), "NOT_FOUND");

console.log("GCP provider-readiness tests passed");
