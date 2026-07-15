import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

const POLICY_PATH = "config/slo-alert-policy.json";
const RUNBOOK_PATH = "docs/architecture/slo-alert-policy.md";
const REQUIRED_DIMENSIONS = ["region", "revision", "service", "operation"];

export function validateSloAlertPolicy(value: unknown) {
  const findings: string[] = [];
  const root = objectValue(value, "policy", findings);

  if (root.schemaVersion !== 1) findings.push("schemaVersion: must be 1");
  if (root.status !== "provisional-unverified") {
    findings.push("status: must remain provisional-unverified until live evidence is bound");
  }
  if (root.measurementWindowDays !== 30) {
    findings.push("measurementWindowDays: must match the approved 30-day planning window");
  }

  const dimensions = stringArray(root.requiredDimensions, "requiredDimensions", findings);
  requireUnique(dimensions, "requiredDimensions", findings);
  for (const dimension of REQUIRED_DIMENSIONS) {
    if (!dimensions.includes(dimension)) findings.push(`requiredDimensions: missing ${dimension}`);
  }

  const evidence = objectValue(root.evidence, "evidence", findings);
  if (evidence.kind !== "repository-policy-only") {
    findings.push("evidence.kind: must be repository-policy-only");
  }
  for (const flag of [
    "approved",
    "deployed",
    "telemetryBindingsVerified",
    "notificationDeliveryTested",
  ]) {
    if (evidence[flag] !== false) findings.push(`evidence.${flag}: must remain false`);
  }
  if (evidence.lastExerciseAt !== null) {
    findings.push("evidence.lastExerciseAt: must remain null until a recorded exercise exists");
  }

  const owners = indexedRecords(root.ownerRoles, "ownerRoles", findings);
  for (const [id, owner] of owners) {
    if (owner.assignmentStatus !== "provisional-unassigned") {
      findings.push(`ownerRoles.${id}.assignmentStatus: must be provisional-unassigned`);
    }
    if (owner.responseCapabilityStatus !== "unverified") {
      findings.push(`ownerRoles.${id}.responseCapabilityStatus: must be unverified`);
    }
  }

  const runbooks = indexedRecords(root.runbooks, "runbooks", findings);
  for (const [id, runbook] of runbooks) {
    if (runbook.path !== RUNBOOK_PATH) {
      findings.push(`runbooks.${id}.path: must be ${RUNBOOK_PATH}`);
    }
    nonEmptyString(runbook.heading, `runbooks.${id}.heading`, findings);
    requireReference(runbook.ownerRole, owners, `runbooks.${id}.ownerRole`, findings);
  }

  const objectives = indexedRecords(root.objectives, "objectives", findings);
  const alerts = indexedRecords(root.alertPolicies, "alertPolicies", findings);
  const objectiveClasses = new Set<string>();
  const referencedAlerts = new Set<string>();

  for (const [id, objective] of objectives) {
    const objectiveClass = objective.class;
    if (objectiveClass !== "critical" && objectiveClass !== "noncritical") {
      findings.push(`objectives.${id}.class: must be critical or noncritical`);
    } else {
      objectiveClasses.add(objectiveClass);
    }

    const indicator = objective.indicator;
    if (!["availability", "latency", "queue-delay"].includes(String(indicator))) {
      findings.push(`objectives.${id}.indicator: unsupported indicator`);
    }
    if (
      typeof objective.targetRatio !== "number" ||
      objective.targetRatio < 0.9 ||
      objective.targetRatio >= 1
    ) {
      findings.push(`objectives.${id}.targetRatio: must be at least 0.9 and below 1`);
    }
    if (objective.windowDays !== 30) {
      findings.push(`objectives.${id}.windowDays: must be 30`);
    }
    nonEmptyString(objective.goodEvent, `objectives.${id}.goodEvent`, findings);
    nonEmptyString(objective.totalEvent, `objectives.${id}.totalEvent`, findings);
    requireReference(objective.ownerRole, owners, `objectives.${id}.ownerRole`, findings);
    if (objective.dataStatus !== "provisional-unverified") {
      findings.push(`objectives.${id}.dataStatus: must be provisional-unverified`);
    }
    if (indicator === "latency") {
      validatePercentiles(objective.dashboardPercentilesMs, `objectives.${id}.dashboardPercentilesMs`, findings);
    }
    if (indicator === "queue-delay") {
      validatePercentiles(
        objective.dashboardPercentilesSeconds,
        `objectives.${id}.dashboardPercentilesSeconds`,
        findings,
      );
    }

    const alertIds = stringArray(objective.alertPolicyIds, `objectives.${id}.alertPolicyIds`, findings);
    requireUnique(alertIds, `objectives.${id}.alertPolicyIds`, findings);
    for (const alertId of alertIds) {
      referencedAlerts.add(alertId);
      if (!alerts.has(alertId)) {
        findings.push(`objectives.${id}.alertPolicyIds: unknown ${alertId}`);
      }
    }
  }

  for (const requiredClass of ["critical", "noncritical"]) {
    if (!objectiveClasses.has(requiredClass)) {
      findings.push(`objectives: missing ${requiredClass} objective`);
    }
  }

  for (const [id, alert] of alerts) {
    const sloIds = stringArray(alert.sloIds, `alertPolicies.${id}.sloIds`, findings);
    requireUnique(sloIds, `alertPolicies.${id}.sloIds`, findings);
    for (const sloId of sloIds) {
      const objective = objectives.get(sloId);
      if (!objective) {
        findings.push(`alertPolicies.${id}.sloIds: unknown ${sloId}`);
        continue;
      }
      const reciprocal = Array.isArray(objective.alertPolicyIds)
        ? objective.alertPolicyIds
        : [];
      if (!reciprocal.includes(id)) {
        findings.push(`alertPolicies.${id}: ${sloId} does not reference this policy`);
      }
    }

    const burnRate = positiveNumber(alert.burnRate, `alertPolicies.${id}.burnRate`, findings);
    if (burnRate !== null && burnRate <= 1) {
      findings.push(`alertPolicies.${id}.burnRate: must exceed 1`);
    }
    const windows = numberArray(alert.windowsMinutes, `alertPolicies.${id}.windowsMinutes`, findings);
    if (windows.length !== 2 || windows[0] >= windows[1]) {
      findings.push(`alertPolicies.${id}.windowsMinutes: must contain ascending short and long windows`);
    }
    if (alert.bothWindowsMustFire !== true) {
      findings.push(`alertPolicies.${id}.bothWindowsMustFire: must be true`);
    }
    positiveInteger(alert.minimumEligibleEvents, `alertPolicies.${id}.minimumEligibleEvents`, findings);
    positiveInteger(alert.responseTargetMinutes, `alertPolicies.${id}.responseTargetMinutes`, findings);
    const action = alert.action;
    if (action !== "page" && action !== "ticket") {
      findings.push(`alertPolicies.${id}.action: must be page or ticket`);
    }
    if ((action === "page" && !["sev1", "sev2"].includes(String(alert.severity))) ||
        (action === "ticket" && alert.severity !== "sev3")) {
      findings.push(`alertPolicies.${id}.severity: does not match action`);
    }
    requireReference(alert.ownerRole, owners, `alertPolicies.${id}.ownerRole`, findings);
    requireReference(
      alert.fallbackOwnerRole,
      owners,
      `alertPolicies.${id}.fallbackOwnerRole`,
      findings,
    );
    if (alert.ownerRole === alert.fallbackOwnerRole) {
      findings.push(`alertPolicies.${id}: owner and fallback owner must differ`);
    }
    requireReference(alert.runbookId, runbooks, `alertPolicies.${id}.runbookId`, findings);
    if (alert.dedupeKey !== "{sloId}:{region}:{service}") {
      findings.push(`alertPolicies.${id}.dedupeKey: must isolate SLO, region and service`);
    }
    const renotify = positiveInteger(alert.renotifyMinutes, `alertPolicies.${id}.renotifyMinutes`, findings);
    if (renotify !== null && windows.length === 2 && renotify < windows[1]) {
      findings.push(`alertPolicies.${id}.renotifyMinutes: must not be shorter than the long window`);
    }
    for (const [field, expected] of [
      ["deploymentStatus", "declared-not-deployed"],
      ["metricBindingStatus", "unverified"],
      ["deliveryTestStatus", "unverified"],
    ] as const) {
      if (alert[field] !== expected) {
        findings.push(`alertPolicies.${id}.${field}: must be ${expected}`);
      }
    }
  }

  for (const id of alerts.keys()) {
    if (!referencedAlerts.has(id)) findings.push(`alertPolicies.${id}: orphan policy`);
  }
  for (const [id, objective] of objectives) {
    const objectiveAlerts = (Array.isArray(objective.alertPolicyIds)
      ? objective.alertPolicyIds
      : [])
      .map((alertId) => alerts.get(String(alertId)))
      .filter((alert): alert is JsonObject => Boolean(alert));
    if (objective.class === "critical") {
      if (!hasBurnAlert(objectiveAlerts, 14.4, 5, 60, "page")) {
        findings.push(`objectives.${id}: missing fast multi-window page`);
      }
      if (!hasBurnAlert(objectiveAlerts, 6, 30, 360, "page")) {
        findings.push(`objectives.${id}: missing sustained multi-window page`);
      }
    } else if (!hasBurnAlert(objectiveAlerts, 3, 120, 1440, "ticket")) {
      findings.push(`objectives.${id}: missing sustained multi-window ticket`);
    }
  }

  const budget = objectValue(root.errorBudgetPolicy, "errorBudgetPolicy", findings);
  if (budget.status !== "provisional-unapproved") {
    findings.push("errorBudgetPolicy.status: must be provisional-unapproved");
  }
  if (budget.freezeNormalReleasesAtSevenDayConsumedRatio !== 0.25) {
    findings.push("errorBudgetPolicy: seven-day release freeze must be 0.25");
  }
  if (budget.freezeNormalReleasesAtThirtyDayConsumedRatio !== 0.5) {
    findings.push("errorBudgetPolicy: thirty-day release freeze must be 0.5");
  }
  if (budget.freezeWhileSev1Unresolved !== true) {
    findings.push("errorBudgetPolicy: unresolved Sev-1 must freeze normal releases");
  }
  const resume = stringArray(budget.resumeRequires, "errorBudgetPolicy.resumeRequires", findings);
  if (resume.length < 3) findings.push("errorBudgetPolicy.resumeRequires: must define recovery gates");

  return findings;
}

export function validateSloAlertRunbookEvidence(
  value: unknown,
  documents: Readonly<Record<string, string>>,
) {
  const findings: string[] = [];
  const root = objectValue(value, "policy", findings);
  for (const runbook of recordArray(root.runbooks, "runbooks", findings)) {
    const id = typeof runbook.id === "string" ? runbook.id : "unknown";
    const path = typeof runbook.path === "string" ? runbook.path : "";
    const heading = typeof runbook.heading === "string" ? runbook.heading : "";
    const source = documents[path];
    if (typeof source !== "string") {
      findings.push(`runbooks.${id}: missing document ${path || "<unset>"}`);
    } else if (!source.includes(`## ${heading}`)) {
      findings.push(`runbooks.${id}: missing heading ${heading || "<unset>"}`);
    }
  }
  return findings;
}

function hasBurnAlert(
  alerts: readonly JsonObject[],
  burnRate: number,
  shortWindow: number,
  longWindow: number,
  action: string,
) {
  return alerts.some((alert) => {
    const windows = Array.isArray(alert.windowsMinutes) ? alert.windowsMinutes : [];
    return (
      alert.action === action &&
      alert.burnRate === burnRate &&
      windows.length === 2 &&
      windows[0] === shortWindow &&
      windows[1] === longWindow &&
      alert.bothWindowsMustFire === true
    );
  });
}

function validatePercentiles(value: unknown, path: string, findings: string[]) {
  const percentiles = objectValue(value, path, findings);
  const p50 = positiveNumber(percentiles.p50, `${path}.p50`, findings);
  const p95 = positiveNumber(percentiles.p95, `${path}.p95`, findings);
  const p99 = positiveNumber(percentiles.p99, `${path}.p99`, findings);
  if (p50 !== null && p95 !== null && p99 !== null && !(p50 < p95 && p95 < p99)) {
    findings.push(`${path}: p50, p95 and p99 must increase`);
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

function stringArray(value: unknown, path: string, findings: string[]) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "string" || !item.trim())
  ) {
    findings.push(`${path}: must be an array of non-empty strings`);
    return [];
  }
  return value as string[];
}

function numberArray(value: unknown, path: string, findings: string[]) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => typeof item !== "number" || item <= 0)
  ) {
    findings.push(`${path}: must be an array of positive numbers`);
    return [];
  }
  return value as number[];
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
  if (typeof value !== "string" || !value.trim()) findings.push(`${path}: must be a non-empty string`);
}

function positiveNumber(value: unknown, path: string, findings: string[]) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    findings.push(`${path}: must be a positive number`);
    return null;
  }
  return value;
}

function positiveInteger(value: unknown, path: string, findings: string[]) {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    findings.push(`${path}: must be a positive integer`);
    return null;
  }
  return value as number;
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

function main() {
  const root = process.cwd();
  const findings: string[] = [];
  let policy: unknown;
  try {
    policy = JSON.parse(readFileSync(join(root, POLICY_PATH), "utf8"));
  } catch (error) {
    findings.push(
      `${POLICY_PATH}: unreadable or invalid JSON (${error instanceof Error ? error.message : "unknown error"})`,
    );
  }

  if (policy) {
    findings.push(...validateSloAlertPolicy(policy));
    const documents: Record<string, string> = {};
    if (existsSync(join(root, RUNBOOK_PATH))) {
      documents[RUNBOOK_PATH] = readFileSync(join(root, RUNBOOK_PATH), "utf8");
    }
    findings.push(...validateSloAlertRunbookEvidence(policy, documents));
  }

  if (findings.length > 0) {
    console.error("SLO and alert policy gate failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  const typed = policy as { objectives: unknown[]; alertPolicies: unknown[] };
  console.log("SLO and alert policy source passed.");
  console.log(`objectives: ${typed.objectives.length}`);
  console.log(`alertPolicies: ${typed.alertPolicies.length}`);
  console.log("deploymentEvidence: unverified");
  console.log("notificationDelivery: unverified");
}

if (isMainModule()) main();
