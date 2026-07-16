import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  validateEmergencyControlDeploymentSources,
  validateIncidentResponseEvidence,
  validateIncidentResponsePolicy,
} from "./check-incident-response-policy";

const readJson = (path: string) =>
  JSON.parse(readFileSync(join(process.cwd(), path), "utf8"));
const policy = readJson("config/incident-response-controls.json");
const ownerPolicy = readJson("config/slo-alert-policy.json");
const githubDeploy = readFileSync(
  join(process.cwd(), ".github/workflows/cloud-run-deploy.yml"),
  "utf8",
);
const localDeploy = readFileSync(
  join(process.cwd(), "scripts/gcp-cloud-run-deploy.ps1"),
  "utf8",
);
const sources = {
  "docs/architecture/incident-response-controls.md": readFileSync(
    join(process.cwd(), "docs/architecture/incident-response-controls.md"),
    "utf8",
  ),
  "docs/gcp-cloud-run-migration-plan.md": readFileSync(
    join(process.cwd(), "docs/gcp-cloud-run-migration-plan.md"),
    "utf8",
  ),
  "src/lib/realtime-service.ts": readFileSync(
    join(process.cwd(), "src/lib/realtime-service.ts"),
    "utf8",
  ),
  "src/lib/emergency-controls.ts": readFileSync(
    join(process.cwd(), "src/lib/emergency-controls.ts"),
    "utf8",
  ),
  "src/app/api/dogs/search/route.ts": readFileSync(
    join(process.cwd(), "src/app/api/dogs/search/route.ts"),
    "utf8",
  ),
  "src/app/api/media/sign-upload/route.ts": readFileSync(
    join(process.cwd(), "src/app/api/media/sign-upload/route.ts"),
    "utf8",
  ),
  "src/app/api/users/me/export/route.ts": readFileSync(
    join(process.cwd(), "src/app/api/users/me/export/route.ts"),
    "utf8",
  ),
  "src/app/api/agents/[type]/run/route.ts": readFileSync(
    join(process.cwd(), "src/app/api/agents/[type]/run/route.ts"),
    "utf8",
  ),
  "src/lib/agent-service.ts": readFileSync(
    join(process.cwd(), "src/lib/agent-service.ts"),
    "utf8",
  ),
  "src/lib/dog-card-service.ts": readFileSync(
    join(process.cwd(), "src/lib/dog-card-service.ts"),
    "utf8",
  ),
};

assert.deepEqual(validateIncidentResponsePolicy(policy, ownerPolicy), []);
assert.deepEqual(validateIncidentResponseEvidence(policy, sources), []);
assert.equal(policy.evidence.emergencyControlDeploymentVerified, false);
assert.equal(policy.evidence.pagingDeliveryTested, false);
assert.match(githubDeploy, /environment:/);
assert.match(localDeploy, /Local production deployment is disabled/);
assert.deepEqual(
  validateEmergencyControlDeploymentSources(githubDeploy, localDeploy),
  [],
);

const failOpenWorkflow = githubDeploy.replace(
  /(\s+echo "::error::\$name must be exactly true or false\." >&2\r?\n)\s+exit 1/,
  "$1                printf 'false'",
);
assert.ok(
  validateEmergencyControlDeploymentSources(failOpenWorkflow, localDeploy).includes(
    "deploy.workflow: emergency flag validation must fail closed",
  ),
);

const permissiveLocalDeploy = localDeploy.replace(
  /(\[ValidateSet\("true", "false", IgnoreCase = \$)false(\)\]\r?\n\s*\[string\]\$SearchDisabled)/,
  "$1true$2",
);
assert.ok(
  validateEmergencyControlDeploymentSources(githubDeploy, permissiveLocalDeploy).includes(
    "deploy.local: SearchDisabled must reject invalid values and default false",
  ),
);

const missingAiMapping = githubDeploy.replace(
  "AI_DISABLED=$ai_disabled",
  "AI_DISABLED_MISSING=$ai_disabled",
);
assert.ok(
  validateEmergencyControlDeploymentSources(missingAiMapping, localDeploy).includes(
    "deploy.workflow: AI_DISABLED is not mapped",
  ),
);

const unsmokedWorkflow = githubDeploy.replace(
  'SMOKE_BASE_URL="${{ steps.deploy.outputs.candidate_url }}" npm run test:smoke',
  "npm run test:smoke",
);
assert.ok(
  validateEmergencyControlDeploymentSources(unsmokedWorkflow, localDeploy).includes(
    "deploy.workflow: candidate smoke must precede traffic promotion",
  ),
);

const leakedCandidateTag = localDeploy.replace('"--remove-tags=$candidateTag"', "");
assert.ok(
  validateEmergencyControlDeploymentSources(githubDeploy, leakedCandidateTag).includes(
    "deploy.local: promoted candidate tag must be removed",
  ),
);
assert.equal(
  policy.controls.filter(
    (control: { implementationStatus: string }) =>
      control.implementationStatus === "repository-implemented",
  ).length,
  5,
);
assert.equal(
  policy.controls.filter(
    (control: { implementationStatus: string }) =>
      control.implementationStatus === "manual-documented",
  ).length,
  0,
);

const falsePagingClaim = structuredClone(policy);
falsePagingClaim.evidence.pagingDeliveryTested = true;
assert.ok(
  validateIncidentResponsePolicy(falsePagingClaim, ownerPolicy).includes(
    "evidence.pagingDeliveryTested: must remain false",
  ),
);

const missingReadOnly = structuredClone(policy);
missingReadOnly.controls = missingReadOnly.controls.filter(
  (control: { id: string }) => control.id !== "read-only-mode",
);
assert.ok(
  validateIncidentResponsePolicy(missingReadOnly, ownerPolicy).includes(
    "controls: missing read-only-mode",
  ),
);

const fakeImplementation = structuredClone(policy);
fakeImplementation.controls[0].implementationEvidence = [
  { path: "src/lib/realtime-service.ts", needle: "REALTIME_BROADCAST_DISABLED" },
];
assert.ok(
  validateIncidentResponsePolicy(fakeImplementation, ownerPolicy).includes(
    "controls.read-only-mode.implementationEvidence: unimplemented controls cannot claim evidence",
  ),
);

const unsafeEvidencePath = structuredClone(policy);
unsafeEvidencePath.controls.find(
  (control: { id: string }) => control.id === "search-disable",
).implementationEvidence[0].path = "C:/outside-repository.md";
assert.ok(
  validateIncidentResponsePolicy(unsafeEvidencePath, ownerPolicy).includes(
    "controls.search-disable.implementationEvidence[0].path: unsafe path",
  ),
);

const unknownOwner = structuredClone(policy);
unknownOwner.runbooks[0].ownerRole = "unknown-owner";
assert.ok(
  validateIncidentResponsePolicy(unknownOwner, ownerPolicy).includes(
    "runbooks.RB-IR-SUDDEN-LOAD-OR-L7.ownerRole: unknown reference",
  ),
);

const incompleteRunbook = structuredClone(policy);
incompleteRunbook.runbooks[0].prohibitedActions = [];
assert.ok(
  validateIncidentResponsePolicy(incompleteRunbook, ownerPolicy).includes(
    "runbooks.RB-IR-SUDDEN-LOAD-OR-L7.prohibitedActions: must be a non-empty string array",
  ),
);

const incompleteFirstFive = structuredClone(policy);
incompleteFirstFive.first30Minutes[0].actions =
  incompleteFirstFive.first30Minutes[0].actions.filter(
    (action: { id: string }) => action.id !== "confirm-user-impact",
  );
assert.ok(
  validateIncidentResponsePolicy(incompleteFirstFive, ownerPolicy).includes(
    "first30Minutes.IR-00-05.actions: missing confirm-user-impact",
  ),
);

assert.ok(
  validateIncidentResponseEvidence(policy, {
    ...sources,
    "src/lib/realtime-service.ts": "missing suppression guard",
  }).includes(
    "controls.realtime-broadcast-disable: evidence needle missing from src/lib/realtime-service.ts",
  ),
);
assert.ok(
  validateIncidentResponseEvidence(policy, {
    ...sources,
    "docs/architecture/incident-response-controls.md": "# Wrong document",
  }).some((finding) => finding.includes("missing heading")),
);

console.log("Incident response policy tests passed");
