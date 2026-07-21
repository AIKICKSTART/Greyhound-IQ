import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  auditDeploymentApprovalControls,
  DEPLOYMENT_APPROVAL_CONTROL_MASTER_EVIDENCE,
  DEPLOYMENT_APPROVAL_CONTROL_REQUIREMENT_ID,
  DEPLOYMENT_APPROVAL_CONTROL_SCOPE,
  DEPLOYMENT_WORKFLOW_BINDINGS,
  type DeploymentWorkflowBinding,
  type DeploymentWorkflowSource,
} from "./deployment-approval-control-evidence";

const sources = collectWorkflowSources(".github/workflows");
assert.deepEqual(auditDeploymentApprovalControls(DEPLOYMENT_WORKFLOW_BINDINGS, sources), []);
assert.equal(sources.length, 5);
assert.equal(DEPLOYMENT_WORKFLOW_BINDINGS.length, 5);
assert.equal(
  DEPLOYMENT_WORKFLOW_BINDINGS.filter(
    ({ classification }) => classification === "production-deployment",
  ).length,
  2,
);

const ciWorkflow =
  sources.find(({ path }) => path.endsWith("/ci.yml"))?.source ?? "";
const cloudRunWorkflow =
  sources.find(({ path }) => path.endsWith("/cloud-run-deploy.yml"))?.source ??
  "";
assert.match(ciWorkflow, /image: postgres:16@sha256:[0-9a-f]{64}/u);
assert.match(
  cloudRunWorkflow,
  /group: cloud-run-\$\{\{ github\.workflow \}\}-\$\{\{ github\.event_name == 'workflow_dispatch' && inputs\.environment \|\| 'staging' \}\}/u,
);
assert.doesNotMatch(
  cloudRunWorkflow.match(/concurrency:[\s\S]*?cancel-in-progress: false/u)?.[0] ?? "",
  /github\.ref/u,
);
assert.equal(
  cloudRunWorkflow.match(
    /google-github-actions\/auth@7c6bc770dae815cd3e89ee6cdf493a5fab2cc093/gu,
  )?.length,
  2,
);
assert.match(
  cloudRunWorkflow,
  /google-github-actions\/setup-gcloud@aa5489c8933f4cc7a4f7d45035b3b1440c9c10db/u,
);
const liveKitGate =
  cloudRunWorkflow.match(
    /- name: Post-deploy LiveKit connectivity check \(staging only\)[\s\S]*?\n      - name: Promote tested revisions/u,
  )?.[0] ?? "";
assert.match(
  liveKitGate,
  /scheduler_name="greyhoundiq-\$ENV_NAME-media-maintenance"/u,
);
assert.match(liveKitGate, /gcloud scheduler jobs describe "\$scheduler_name"/u);
assert.match(liveKitGate, /\$CANDIDATE_URL\/api\/internal\/community-readiness/u);
assert.match(liveKitGate, /\.checks\.livekit == "ok"/u);
assert.match(liveKitGate, /echo "::add-mask::\$internal_secret"/u);
assert.doesNotMatch(liveKitGate, /gcloud secrets versions access latest/u);
assert.doesNotMatch(liveKitGate, /skipping LiveKit connectivity check/u);

const requirement = SECURITY_MASTER_REQUIREMENTS.find(
  ({ id }) => id === DEPLOYMENT_APPROVAL_CONTROL_REQUIREMENT_ID,
);
assert.equal(
  requirement?.requirement,
  "Create a supply-chain control for deployment approval.",
);
const evidence =
  DEPLOYMENT_APPROVAL_CONTROL_MASTER_EVIDENCE[
    DEPLOYMENT_APPROVAL_CONTROL_REQUIREMENT_ID
  ];
assert.equal(evidence.status, "verified");
for (const path of evidence.evidence) {
  assert.ok(existsSync(path), `missing deployment-approval evidence: ${path}`);
}
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /every current GitHub Actions workflow/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /manual-dispatch/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /immutable image/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /no-traffic candidate/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /smoke-tests/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /blocks seeding/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /current source controls only/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /does not claim GitHub environment reviewer configuration/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /branch protection/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /executed approval/i);
assert.match(DEPLOYMENT_APPROVAL_CONTROL_SCOPE, /production readiness/i);

const fixtureBindings: readonly DeploymentWorkflowBinding[] = [
  {
    path: ".github/workflows/fixture-deploy.yml",
    classification: "production-deployment",
    deploymentMarkers: ["gcloud run deploy"],
    approvalMarkers: [
      "workflow_dispatch:",
      "environment: production",
      "cancel-in-progress: false",
    ],
  },
  {
    path: ".github/workflows/fixture-check.yml",
    classification: "non-deployment",
    deploymentMarkers: [],
    approvalMarkers: [],
  },
];
const fixtureSources: readonly DeploymentWorkflowSource[] = [
  {
    path: fixtureBindings[0].path,
    source: [
      "on:",
      "  workflow_dispatch:",
      "concurrency:",
      "  cancel-in-progress: false",
      "jobs:",
      "  deploy:",
      "    environment: production",
      "    steps:",
      "      - run: gcloud run deploy fixture",
    ].join("\n"),
  },
  {
    path: fixtureBindings[1].path,
    source: "on: pull_request\njobs:\n  check:\n    steps:\n      - run: npm test",
  },
];

assert.deepEqual(
  auditDeploymentApprovalControls(fixtureBindings, fixtureSources),
  [],
);
assertIssue([], [], "DEPLOYMENT_APPROVAL_SOURCE_INVENTORY_VACUOUS");
assertIssue([], [], "DEPLOYMENT_APPROVAL_BINDING_INVENTORY_VACUOUS");
assertIssue(
  fixtureBindings,
  [...fixtureSources, fixtureSources[0]],
  "DEPLOYMENT_APPROVAL_SOURCE_PATH_DUPLICATE",
);
assertIssue(
  [...fixtureBindings, fixtureBindings[0]],
  fixtureSources,
  "DEPLOYMENT_APPROVAL_BINDING_PATH_DUPLICATE",
);
assertIssue(
  fixtureBindings,
  [...fixtureSources, { path: ".github/workflows/new.yml", source: "on: push" }],
  "DEPLOYMENT_APPROVAL_WORKFLOW_UNREVIEWED",
);
assertIssue(
  fixtureBindings,
  fixtureSources.slice(1),
  "DEPLOYMENT_APPROVAL_BOUND_WORKFLOW_MISSING",
);
assertIssue(
  fixtureBindings,
  fixtureSources.map((record) =>
    record.path === fixtureBindings[0].path
      ? { ...record, source: record.source.replace("gcloud run deploy", "echo") }
      : record,
  ),
  "DEPLOYMENT_APPROVAL_COMMAND_MISSING",
);
assertIssue(
  fixtureBindings,
  fixtureSources.map((record) =>
    record.path === fixtureBindings[0].path
      ? { ...record, source: record.source.replace("workflow_dispatch:", "push:") }
      : record,
  ),
  "DEPLOYMENT_APPROVAL_MARKER_MISSING",
);
assertIssue(
  [
    fixtureBindings[0],
    {
      ...fixtureBindings[1],
      deploymentMarkers: ["gcloud run deploy"],
    },
  ],
  fixtureSources,
  "DEPLOYMENT_APPROVAL_NON_DEPLOY_BINDING_INVALID",
);
assertIssue(
  fixtureBindings,
  fixtureSources.map((record) =>
    record.path === fixtureBindings[1].path
      ? { ...record, source: `${record.source}\n- run: gcloud run deploy bypass` }
      : record,
  ),
  "DEPLOYMENT_APPROVAL_UNREGISTERED_DEPLOYMENT",
);
assertIssue(
  fixtureBindings.map((binding) => ({
    ...binding,
    classification: "non-deployment" as const,
    deploymentMarkers: [],
    approvalMarkers: [],
  })),
  fixtureSources.map((record) => ({
    ...record,
    source: record.source.replace("gcloud run deploy", "echo"),
  })),
  "DEPLOYMENT_APPROVAL_PRODUCTION_BINDINGS_VACUOUS",
);

console.log(
  "Deployment-approval control passed: all 5 GitHub Actions workflows are classified and both production deployment paths are manual and environment-bound.",
);

function collectWorkflowSources(root: string): DeploymentWorkflowSource[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => join(root, entry.name).replaceAll("\\", "/"))
    .sort()
    .map((path) => ({ path, source: readFileSync(path, "utf8") }));
}

function assertIssue(
  bindings: readonly DeploymentWorkflowBinding[],
  workflowSources: readonly DeploymentWorkflowSource[],
  expected: string,
) {
  const issues = auditDeploymentApprovalControls(bindings, workflowSources);
  assert.ok(
    issues.some((issue) => issue.startsWith(expected)),
    `${expected}: ${issues.join(" | ")}`,
  );
}
