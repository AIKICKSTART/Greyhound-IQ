import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { validateSloAlertPolicy } from "./check-slo-alert-policy";

type JsonObject = Record<string, unknown>;

const POLICY_PATH = "config/incident-response-controls.json";
const OWNER_POLICY_PATH = "config/slo-alert-policy.json";
const RUNBOOK_PATH = "docs/architecture/incident-response-controls.md";
const DEPLOY_WORKFLOW_PATH = ".github/workflows/cloud-run-deploy.yml";
const LOCAL_DEPLOY_PATH = "scripts/gcp-cloud-run-deploy.ps1";
const EMERGENCY_DEPLOY_CONTROLS = [
  ["SEARCH_DISABLED", "search_disabled", "SearchDisabled"],
  ["UPLOAD_DISABLED", "upload_disabled", "UploadDisabled"],
  ["EXPORT_DISABLED", "export_disabled", "ExportDisabled"],
  ["AI_DISABLED", "ai_disabled", "AiDisabled"],
  [
    "REALTIME_BROADCAST_DISABLED",
    "realtime_broadcast_disabled",
    "RealtimeBroadcastDisabled",
  ],
] as const;
const REQUIRED_CONTROLS = [
  "read-only-mode",
  "anonymous-restriction",
  "search-disable",
  "report-disable",
  "export-disable",
  "upload-disable",
  "ai-disable",
  "queue-pause",
  "database-write-protection",
  "revision-rollback",
  "regional-ejection",
  "database-region-promotion",
];
const REQUIRED_PHASES: Readonly<Record<string, readonly [number, number, ...string[]]>> = {
  "IR-00-05": [
    0,
    5,
    "confirm-user-impact",
    "declare-severity",
    "freeze-changes",
    "assign-incident-roles",
    "open-channel-timeline",
    "classify-failure-domain",
    "check-security-indicators",
  ],
  "IR-05-15": [
    5,
    15,
    "apply-least-destructive-containment",
    "differentiate-demand-from-abuse",
    "rollback-suspect-revision",
    "protect-database",
    "contain-slow-dependency",
    "engage-provider",
    "publish-first-status",
  ],
  "IR-15-30": [
    15,
    30,
    "verify-containment-externally",
    "choose-service-mode",
    "validate-data-and-queues",
    "confirm-monitoring-and-paging",
    "set-decision-checkpoint",
    "update-communications",
  ],
};

export function validateIncidentResponsePolicy(value: unknown, ownerPolicy: unknown) {
  const findings: string[] = [];
  for (const finding of validateSloAlertPolicy(ownerPolicy)) {
    findings.push(`ownerPolicy: ${finding}`);
  }
  const ownerRoot = objectValue(ownerPolicy, "ownerPolicy", findings);
  const owners = indexedRecords(ownerRoot.ownerRoles, "ownerPolicy.ownerRoles", findings);
  const root = objectValue(value, "policy", findings);

  if (root.schemaVersion !== 1) findings.push("schemaVersion: must be 1");
  if (root.status !== "provisional-unverified") {
    findings.push("status: must remain provisional-unverified");
  }
  if (root.ownerPolicyPath !== OWNER_POLICY_PATH) {
    findings.push(`ownerPolicyPath: must be ${OWNER_POLICY_PATH}`);
  }
  const evidence = objectValue(root.evidence, "evidence", findings);
  if (evidence.kind !== "repository-policy-only") {
    findings.push("evidence.kind: must be repository-policy-only");
  }
  for (const flag of [
    "emergencyControlDeploymentVerified",
    "pagingDeliveryTested",
    "namedRosterVerified",
    "exerciseCompleted",
  ]) {
    if (evidence[flag] !== false) findings.push(`evidence.${flag}: must remain false`);
  }

  const phases = indexedRecords(root.first30Minutes, "first30Minutes", findings);
  for (const [phaseId, [startMinute, endMinute, ...requiredActions]] of Object.entries(
    REQUIRED_PHASES,
  )) {
    const phase = phases.get(phaseId);
    if (!phase) {
      findings.push(`first30Minutes: missing ${phaseId}`);
      continue;
    }
    if (phase.startMinute !== startMinute || phase.endMinute !== endMinute) {
      findings.push(`first30Minutes.${phaseId}: expected minutes ${startMinute}-${endMinute}`);
    }
    const actions = indexedRecords(
      phase.actions,
      `first30Minutes.${phaseId}.actions`,
      findings,
    );
    for (const actionId of requiredActions) {
      if (!actions.has(actionId)) {
        findings.push(`first30Minutes.${phaseId}.actions: missing ${actionId}`);
      }
    }
    for (const [actionId, action] of actions) {
      requireReference(
        action.ownerRole,
        owners,
        `first30Minutes.${phaseId}.actions.${actionId}.ownerRole`,
        findings,
      );
      nonEmptyString(
        action.action,
        `first30Minutes.${phaseId}.actions.${actionId}.action`,
        findings,
      );
    }
  }

  const controls = indexedRecords(root.controls, "controls", findings);
  const implementationStates = new Set<string>();
  for (const controlId of REQUIRED_CONTROLS) {
    if (!controls.has(controlId)) findings.push(`controls: missing ${controlId}`);
  }
  for (const [id, control] of controls) {
    nonEmptyString(control.title, `controls.${id}.title`, findings);
    const status = String(control.implementationStatus);
    if (!["repository-implemented", "manual-documented", "unimplemented"].includes(status)) {
      findings.push(`controls.${id}.implementationStatus: unsupported status`);
    } else {
      implementationStates.add(status);
    }
    requireOwnerPair(control, owners, `controls.${id}`, findings);
    nonEmptyString(control.activationMethod, `controls.${id}.activationMethod`, findings);
    nonEmptyString(control.rollbackMethod, `controls.${id}.rollbackMethod`, findings);
    if (control.auditEventStatus !== "unverified") {
      findings.push(`controls.${id}.auditEventStatus: must remain unverified`);
    }
    if (control.testStatus !== "unverified") {
      findings.push(`controls.${id}.testStatus: must remain unverified`);
    }

    const implementationEvidence = recordArray(
      control.implementationEvidence,
      `controls.${id}.implementationEvidence`,
      findings,
    );
    if (status === "unimplemented") {
      if (control.deploymentStatus !== "not-deployed") {
        findings.push(`controls.${id}.deploymentStatus: unimplemented controls are not-deployed`);
      }
      if (implementationEvidence.length > 0) {
        findings.push(`controls.${id}.implementationEvidence: unimplemented controls cannot claim evidence`);
      }
    } else {
      if (control.deploymentStatus !== "unverified") {
        findings.push(`controls.${id}.deploymentStatus: must remain unverified`);
      }
      if (implementationEvidence.length === 0) {
        findings.push(`controls.${id}.implementationEvidence: repository evidence is required`);
      }
    }
    for (const [index, item] of implementationEvidence.entries()) {
      const path = nonEmptyString(
        item.path,
        `controls.${id}.implementationEvidence[${index}].path`,
        findings,
      );
      nonEmptyString(
        item.needle,
        `controls.${id}.implementationEvidence[${index}].needle`,
        findings,
      );
      if (path && !isSafeRepoPath(path)) {
        findings.push(`controls.${id}.implementationEvidence[${index}].path: unsafe path`);
      }
    }
  }
  for (const status of ["repository-implemented", "unimplemented"]) {
    if (!implementationStates.has(status)) {
      findings.push(`controls: missing ${status} classification`);
    }
  }

  const runbooks = indexedRecords(root.runbooks, "runbooks", findings);
  const coveredControls = new Set<string>();
  for (const [id, runbook] of runbooks) {
    nonEmptyString(runbook.title, `runbooks.${id}.title`, findings);
    if (runbook.docPath !== RUNBOOK_PATH) {
      findings.push(`runbooks.${id}.docPath: must be ${RUNBOOK_PATH}`);
    }
    nonEmptyString(runbook.heading, `runbooks.${id}.heading`, findings);
    requireOwnerPair(runbook, owners, `runbooks.${id}`, findings);
    nonEmptyString(runbook.trigger, `runbooks.${id}.trigger`, findings);
    nonEmptyString(runbook.safeFirstAction, `runbooks.${id}.safeFirstAction`, findings);
    requiredStrings(runbook.prohibitedActions, `runbooks.${id}.prohibitedActions`, findings);
    requiredStrings(runbook.recoveryValidation, `runbooks.${id}.recoveryValidation`, findings);
    requiredStrings(runbook.evidencePreservation, `runbooks.${id}.evidencePreservation`, findings);
    const controlIds = requiredStrings(runbook.controlIds, `runbooks.${id}.controlIds`, findings);
    requireUnique(controlIds, `runbooks.${id}.controlIds`, findings);
    for (const controlId of controlIds) {
      coveredControls.add(controlId);
      if (!controls.has(controlId)) findings.push(`runbooks.${id}.controlIds: unknown ${controlId}`);
    }
    if (runbook.testStatus !== "unverified") {
      findings.push(`runbooks.${id}.testStatus: must remain unverified`);
    }
    if (runbook.pagingDeliveryStatus !== "unverified") {
      findings.push(`runbooks.${id}.pagingDeliveryStatus: must remain unverified`);
    }
    if (!Array.isArray(runbook.exerciseEvidence) || runbook.exerciseEvidence.length !== 0) {
      findings.push(`runbooks.${id}.exerciseEvidence: must remain empty until an exercise is recorded`);
    }
  }
  for (const controlId of controls.keys()) {
    if (!coveredControls.has(controlId)) findings.push(`controls.${controlId}: not covered by a runbook`);
  }

  return findings;
}

export function validateIncidentResponseEvidence(
  value: unknown,
  sources: Readonly<Record<string, string>>,
) {
  const findings: string[] = [];
  const root = objectValue(value, "policy", findings);
  for (const control of recordArray(root.controls, "controls", findings)) {
    const id = typeof control.id === "string" ? control.id : "unknown";
    for (const item of recordArray(
      control.implementationEvidence,
      `controls.${id}.implementationEvidence`,
      findings,
    )) {
      const path = typeof item.path === "string" ? item.path : "";
      const needle = typeof item.needle === "string" ? item.needle : "";
      const source = sources[path];
      if (typeof source !== "string") {
        findings.push(`controls.${id}: missing evidence source ${path || "<unset>"}`);
      } else if (!source.includes(needle)) {
        findings.push(`controls.${id}: evidence needle missing from ${path}`);
      }
    }
  }
  for (const runbook of recordArray(root.runbooks, "runbooks", findings)) {
    const id = typeof runbook.id === "string" ? runbook.id : "unknown";
    const path = typeof runbook.docPath === "string" ? runbook.docPath : "";
    const heading = typeof runbook.heading === "string" ? runbook.heading : "";
    const source = sources[path];
    if (typeof source !== "string") {
      findings.push(`runbooks.${id}: missing document ${path || "<unset>"}`);
    } else if (!source.includes(`## ${heading}`)) {
      findings.push(`runbooks.${id}: missing heading ${heading || "<unset>"}`);
    }
  }
  return findings;
}

export function validateEmergencyControlDeploymentSources(
  workflow: string,
  localDeploy: string,
) {
  const findings: string[] = [];
  const emergencyFlagNormalizer =
    workflow.match(/normalize_emergency_flag\(\)\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
  if (
    !/normalize_emergency_flag\(\)[\s\S]*case "\$value" in[\s\S]*""\|false\)[\s\S]*true\)[\s\S]*\*\)[\s\S]*exit 1[\s\S]*esac/.test(
      emergencyFlagNormalizer,
    )
  ) {
    findings.push("deploy.workflow: emergency flag validation must fail closed");
  }

  for (const [environmentName, workflowName, localName] of EMERGENCY_DEPLOY_CONTROLS) {
    const workflowInput = new RegExp(
      `\\n      ${workflowName}:[\\s\\S]{0,220}default: "false"[\\s\\S]{0,160}options: \\["false", "true"\\]`,
    );
    if (!workflowInput.test(workflow)) {
      findings.push(`deploy.workflow: ${workflowName} must be a false-default choice`);
    }
    if (!workflow.includes(`${environmentName}=$${workflowName}`)) {
      findings.push(`deploy.workflow: ${environmentName} is not mapped`);
    }

    const localParameter = new RegExp(
      `\\[ValidateSet\\("true", "false", IgnoreCase = \\$false\\)\\]\\s*\\[string\\]\\$${localName} = "false"`,
    );
    if (!localParameter.test(localDeploy)) {
      findings.push(`deploy.local: ${localName} must reject invalid values and default false`);
    }
    if (!localDeploy.includes(`"${environmentName}=$${localName}"`)) {
      findings.push(`deploy.local: ${environmentName} is not mapped`);
    }
  }

  const workflowSmoke = workflow.indexOf(
    'SMOKE_BASE_URL="${{ steps.deploy.outputs.candidate_url }}" npm run test:smoke',
  );
  const workflowPromotion = workflow.indexOf("gcloud run services update-traffic");
  if (
    !workflow.includes("--no-traffic") ||
    workflowSmoke < 0 ||
    workflowPromotion < 0 ||
    workflowSmoke >= workflowPromotion
  ) {
    findings.push("deploy.workflow: candidate smoke must precede traffic promotion");
  }
  if (
    !workflow.includes('--remove-tags "${{ steps.deploy.outputs.candidate_tag }}"')
  ) {
    findings.push("deploy.workflow: promoted candidate tag must be removed");
  }

  const localSmoke = localDeploy.indexOf("$env:SMOKE_BASE_URL = $candidateUrl");
  const localPromotion = localDeploy.indexOf("Invoke-Gcloud run services update-traffic");
  if (
    !localDeploy.includes('"--no-traffic"') ||
    localSmoke < 0 ||
    localPromotion < 0 ||
    localSmoke >= localPromotion ||
    localDeploy.includes("--to-latest")
  ) {
    findings.push("deploy.local: tagged candidate smoke must precede exact revision promotion");
  }
  if (!localDeploy.includes('"--remove-tags=$candidateTag"')) {
    findings.push("deploy.local: promoted candidate tag must be removed");
  }

  if (/set -x|echo\s+["']?\$env_vars/.test(workflow)) {
    findings.push("deploy.workflow: runtime environment values must not be logged");
  }
  if (/Write-(?:Host|Output)[^\r\n]*\$plainEnv/.test(localDeploy)) {
    findings.push("deploy.local: runtime environment values must not be logged");
  }
  return findings;
}

function requireOwnerPair(
  record: JsonObject,
  owners: ReadonlyMap<string, JsonObject>,
  path: string,
  findings: string[],
) {
  requireReference(record.ownerRole, owners, `${path}.ownerRole`, findings);
  requireReference(record.fallbackOwnerRole, owners, `${path}.fallbackOwnerRole`, findings);
  if (record.ownerRole === record.fallbackOwnerRole) {
    findings.push(`${path}: owner and fallback owner must differ`);
  }
}

function indexedRecords(value: unknown, path: string, findings: string[]) {
  const records = recordArray(value, path, findings);
  const index = new Map<string, JsonObject>();
  for (const [position, record] of records.entries()) {
    const id = record.id;
    if (typeof id !== "string" || !id.trim()) {
      findings.push(`${path}[${position}].id: must be a non-empty string`);
    } else if (index.has(id)) {
      findings.push(`${path}: duplicate id ${id}`);
    } else {
      index.set(id, record);
    }
  }
  if (records.length === 0) findings.push(`${path}: must not be empty`);
  return index;
}

function recordArray(value: unknown, path: string, findings: string[]) {
  if (!Array.isArray(value)) {
    findings.push(`${path}: must be an array`);
    return [];
  }
  return value.map((item, index) => objectValue(item, `${path}[${index}]`, findings));
}

function requiredStrings(value: unknown, path: string, findings: string[]) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    findings.push(`${path}: must be a non-empty string array`);
    return [];
  }
  return value as string[];
}

function requireUnique(values: readonly string[], path: string, findings: string[]) {
  if (new Set(values).size !== values.length) findings.push(`${path}: values must be unique`);
}

function requireReference(
  value: unknown,
  index: ReadonlyMap<string, JsonObject>,
  path: string,
  findings: string[],
) {
  if (typeof value !== "string" || !index.has(value)) findings.push(`${path}: unknown reference`);
}

function nonEmptyString(value: unknown, path: string, findings: string[]) {
  if (typeof value !== "string" || !value.trim()) {
    findings.push(`${path}: must be a non-empty string`);
    return null;
  }
  return value;
}

function isSafeRepoPath(value: string) {
  return (
    !value.includes("\\") &&
    !value.includes(":") &&
    !value.startsWith("/") &&
    !value.split("/").includes("..")
  );
}

function objectValue(value: unknown, path: string, findings: string[]): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    findings.push(`${path}: must be an object`);
    return {};
  }
  return value as JsonObject;
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry && resolve(entry) === fileURLToPath(import.meta.url));
}

function collectSourcePaths(value: unknown) {
  const root = value as { controls?: unknown[]; runbooks?: unknown[] };
  const paths = new Set<string>();
  for (const control of Array.isArray(root.controls) ? root.controls : []) {
    const record = control as { implementationEvidence?: Array<{ path?: unknown }> };
    for (const evidence of record.implementationEvidence ?? []) {
      if (typeof evidence.path === "string" && isSafeRepoPath(evidence.path)) {
        paths.add(evidence.path);
      }
    }
  }
  for (const runbook of Array.isArray(root.runbooks) ? root.runbooks : []) {
    const path = (runbook as { docPath?: unknown }).docPath;
    if (typeof path === "string" && isSafeRepoPath(path)) paths.add(path);
  }
  return paths;
}

function loadJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function main() {
  const root = process.cwd();
  const findings: string[] = [];
  let policy: unknown;
  let ownerPolicy: unknown;
  try {
    policy = loadJson(join(root, POLICY_PATH));
  } catch (error) {
    findings.push(`${POLICY_PATH}: unreadable or invalid JSON (${errorMessage(error)})`);
  }
  try {
    ownerPolicy = loadJson(join(root, OWNER_POLICY_PATH));
  } catch (error) {
    findings.push(`${OWNER_POLICY_PATH}: unreadable or invalid JSON (${errorMessage(error)})`);
  }
  try {
    findings.push(
      ...validateEmergencyControlDeploymentSources(
        readFileSync(join(root, DEPLOY_WORKFLOW_PATH), "utf8"),
        readFileSync(join(root, LOCAL_DEPLOY_PATH), "utf8"),
      ),
    );
  } catch (error) {
    findings.push(`emergency deploy sources: unreadable (${errorMessage(error)})`);
  }
  if (policy && ownerPolicy) {
    findings.push(...validateIncidentResponsePolicy(policy, ownerPolicy));
    const sources: Record<string, string> = {};
    for (const path of collectSourcePaths(policy)) {
      const fullPath = join(root, path);
      if (existsSync(fullPath)) sources[path] = readFileSync(fullPath, "utf8");
    }
    findings.push(...validateIncidentResponseEvidence(policy, sources));
  }
  if (findings.length > 0) {
    console.error("Incident response policy gate failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  const typed = policy as { controls: JsonObject[]; runbooks: JsonObject[] };
  const counts = Object.groupBy(typed.controls, (control) => String(control.implementationStatus));
  console.log("Incident response policy source passed.");
  console.log(`controls: ${typed.controls.length}`);
  console.log(`runbooks: ${typed.runbooks.length}`);
  console.log(
    `controlStatus: repository-implemented=${counts["repository-implemented"]?.length ?? 0}, manual-documented=${counts["manual-documented"]?.length ?? 0}, unimplemented=${counts.unimplemented?.length ?? 0}`,
  );
  console.log("deploymentEvidence: unverified");
  console.log("pagingDelivery: unverified");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

if (isMainModule()) main();
