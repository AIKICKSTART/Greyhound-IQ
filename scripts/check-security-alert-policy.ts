import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { SECURITY_ALERT_EVENT_REQUIREMENT_IDS } from "../security/security-alert-event-evidence";

type JsonObject = Record<string, unknown>;

const POLICY_PATH = "config/security-alert-policy.json";
const QUERY_LANGUAGES = new Set([
  "github-rest",
  "google-cloud-logging",
  "postgresql",
]);
const SEVERITIES = new Set(["critical", "high", "medium", "low"]);
const THRESHOLD_OPERATORS = new Set([">=", ">", "=="]);
const UNVERIFIED_STATUS_FIELDS = {
  deploymentStatus: "not-deployed",
  metricBindingStatus: "unverified",
  notificationDeliveryStatus: "unverified",
  drillStatus: "unverified",
} as const;
const PLACEHOLDER_PATTERN = /\b(?:todo|tbd|placeholder|replace[-_ ]?me)\b|[<{][A-Z_]+[>}]/i;

export function validateSecurityAlertPolicy(value: unknown) {
  const findings: string[] = [];
  const root = objectValue(value, "policy", findings);

  if (root.schemaVersion !== 1) findings.push("schemaVersion: must be 1");
  if (root.status !== "source-definition-only") {
    findings.push("status: must remain source-definition-only");
  }

  const evidence = objectValue(root.evidence, "evidence", findings);
  if (evidence.kind !== "repository-source-definition") {
    findings.push("evidence.kind: must be repository-source-definition");
  }
  for (const flag of [
    "deployed",
    "metricBindingsVerified",
    "notificationDeliveryTested",
    "drillsExecuted",
  ]) {
    if (evidence[flag] !== false) findings.push(`evidence.${flag}: must remain false`);
  }
  if (evidence.lastDrillAt !== null) {
    findings.push("evidence.lastDrillAt: must remain null until a recorded drill exists");
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

  const alerts = recordArray(root.alerts, "alerts", findings);
  const expectedRequirements = new Set<string>(SECURITY_ALERT_EVENT_REQUIREMENT_IDS);
  const seenRequirements = new Set<string>();
  const seenAlertIds = new Set<string>();
  const seenTitles = new Set<string>();
  const seenRunbookIds = new Set<string>();

  for (const [position, alert] of alerts.entries()) {
    const basePath = `alerts[${position}]`;
    const requirementId = requiredString(
      alert.requirementId,
      `${basePath}.requirementId`,
      findings,
    );
    if (requirementId) {
      if (!expectedRequirements.has(requirementId)) {
        findings.push(`${basePath}.requirementId: unexpected ${requirementId}`);
      }
      if (seenRequirements.has(requirementId)) {
        findings.push(`${basePath}.requirementId: duplicate ${requirementId}`);
      }
      seenRequirements.add(requirementId);
    }

    const id = uniqueString(alert.id, `${basePath}.id`, seenAlertIds, findings);
    uniqueString(alert.title, `${basePath}.title`, seenTitles, findings);

    const detection = objectValue(alert.detection, `${basePath}.detection`, findings);
    requiredString(detection.source, `${basePath}.detection.source`, findings);
    const queryLanguage = requiredString(
      detection.queryLanguage,
      `${basePath}.detection.queryLanguage`,
      findings,
    );
    if (queryLanguage && !QUERY_LANGUAGES.has(queryLanguage)) {
      findings.push(`${basePath}.detection.queryLanguage: unsupported ${queryLanguage}`);
    }
    const query = concreteString(detection.query, `${basePath}.detection.query`, findings, 40);
    concreteString(detection.signal, `${basePath}.detection.signal`, findings, 12);
    const groupBy = stringArray(detection.groupBy, `${basePath}.detection.groupBy`, findings);
    requireUnique(groupBy, `${basePath}.detection.groupBy`, findings);
    validateQuery(queryLanguage, query, `${basePath}.detection.query`, findings);

    const threshold = objectValue(alert.threshold, `${basePath}.threshold`, findings);
    if (!THRESHOLD_OPERATORS.has(String(threshold.operator))) {
      findings.push(`${basePath}.threshold.operator: must be >=, > or ==`);
    }
    positiveNumber(threshold.value, `${basePath}.threshold.value`, findings);
    positiveInteger(
      threshold.windowMinutes,
      `${basePath}.threshold.windowMinutes`,
      findings,
    );
    positiveInteger(
      threshold.minimumSamples,
      `${basePath}.threshold.minimumSamples`,
      findings,
    );

    if (!SEVERITIES.has(String(alert.severity))) {
      findings.push(`${basePath}.severity: must be critical, high, medium or low`);
    }
    requireReference(alert.ownerRole, owners, `${basePath}.ownerRole`, findings);

    const runbook = objectValue(alert.runbook, `${basePath}.runbook`, findings);
    const runbookId = uniqueString(
      runbook.id,
      `${basePath}.runbook.id`,
      seenRunbookIds,
      findings,
    );
    if (id && runbookId && !runbookId.startsWith("RB-")) {
      findings.push(`${basePath}.runbook.id: must use the RB- prefix`);
    }
    const investigationSteps = stringArray(
      runbook.investigationSteps,
      `${basePath}.runbook.investigationSteps`,
      findings,
    );
    if (investigationSteps.length < 2) {
      findings.push(`${basePath}.runbook.investigationSteps: must contain at least two steps`);
    }
    const containmentSteps = stringArray(
      runbook.containmentSteps,
      `${basePath}.runbook.containmentSteps`,
      findings,
    );
    if (containmentSteps.length < 2) {
      findings.push(`${basePath}.runbook.containmentSteps: must contain at least two steps`);
    }
    concreteString(
      runbook.escalationPath,
      `${basePath}.runbook.escalationPath`,
      findings,
      20,
    );

    const response = objectValue(alert.response, `${basePath}.response`, findings);
    const automatic = stringArray(
      response.automatic,
      `${basePath}.response.automatic`,
      findings,
    );
    if (automatic.length < 1) {
      findings.push(`${basePath}.response.automatic: must define an automatic response`);
    }
    const manual = stringArray(response.manual, `${basePath}.response.manual`, findings);
    if (manual.length < 1) {
      findings.push(`${basePath}.response.manual: must define a manual response`);
    }

    const falsePositive = objectValue(
      alert.falsePositiveReview,
      `${basePath}.falsePositiveReview`,
      findings,
    );
    requiredString(
      falsePositive.cadence,
      `${basePath}.falsePositiveReview.cadence`,
      findings,
    );
    const falsePositiveSteps = stringArray(
      falsePositive.steps,
      `${basePath}.falsePositiveReview.steps`,
      findings,
    );
    if (falsePositiveSteps.length < 2) {
      findings.push(`${basePath}.falsePositiveReview.steps: must contain at least two steps`);
    }

    const testMethod = objectValue(alert.testMethod, `${basePath}.testMethod`, findings);
    requiredString(testMethod.kind, `${basePath}.testMethod.kind`, findings);
    concreteString(
      testMethod.procedure,
      `${basePath}.testMethod.procedure`,
      findings,
      30,
    );
    concreteString(
      testMethod.expectedSignal,
      `${basePath}.testMethod.expectedSignal`,
      findings,
      20,
    );

    for (const [field, expected] of Object.entries(UNVERIFIED_STATUS_FIELDS)) {
      if (alert[field] !== expected) {
        findings.push(`${basePath}.${field}: must be ${expected}`);
      }
    }
  }

  for (const requirementId of expectedRequirements) {
    if (!seenRequirements.has(requirementId)) {
      findings.push(`alerts: missing requirement ${requirementId}`);
    }
  }
  if (alerts.length !== expectedRequirements.size) {
    findings.push(`alerts: must contain exactly ${expectedRequirements.size} definitions`);
  }

  return findings;
}

function validateQuery(
  language: string | null,
  query: string | null,
  path: string,
  findings: string[],
) {
  if (!language || !query) return;
  if (language === "postgresql") {
    if (!/^\s*SELECT\b/i.test(query) || !/\bFROM\b/i.test(query)) {
      findings.push(`${path}: PostgreSQL detection must be a SELECT query with FROM`);
    }
  } else if (language === "google-cloud-logging") {
    if (!/\bresource\.type\s*=/.test(query)) {
      findings.push(`${path}: Cloud Logging query must bind resource.type`);
    }
  } else if (language === "github-rest") {
    if (!query.startsWith("GET /repos/") || !query.includes("?state=open")) {
      findings.push(`${path}: GitHub query must be a concrete open-alert repository GET`);
    }
  }
}

function indexedRecords(value: unknown, path: string, findings: string[]) {
  const records = recordArray(value, path, findings);
  const index = new Map<string, JsonObject>();
  for (const [position, record] of records.entries()) {
    const id = requiredString(record.id, `${path}[${position}].id`, findings);
    if (!id) continue;
    if (index.has(id)) findings.push(`${path}: duplicate id ${id}`);
    else index.set(id, record);
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

function objectValue(value: unknown, path: string, findings: string[]): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    findings.push(`${path}: must be an object`);
    return {};
  }
  return value as JsonObject;
}

function requiredString(value: unknown, path: string, findings: string[]) {
  if (typeof value !== "string" || !value.trim()) {
    findings.push(`${path}: must be a non-empty string`);
    return null;
  }
  return value.trim();
}

function concreteString(
  value: unknown,
  path: string,
  findings: string[],
  minimumLength: number,
) {
  const result = requiredString(value, path, findings);
  if (!result) return null;
  if (result.length < minimumLength) {
    findings.push(`${path}: must contain at least ${minimumLength} characters`);
  }
  if (PLACEHOLDER_PATTERN.test(result)) {
    findings.push(`${path}: must not contain placeholders`);
  }
  return result;
}

function uniqueString(
  value: unknown,
  path: string,
  seen: Set<string>,
  findings: string[],
) {
  const result = requiredString(value, path, findings);
  if (!result) return null;
  if (seen.has(result)) findings.push(`${path}: duplicate ${result}`);
  seen.add(result);
  return result;
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

function positiveNumber(value: unknown, path: string, findings: string[]) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    findings.push(`${path}: must be a positive number`);
  }
}

function positiveInteger(value: unknown, path: string, findings: string[]) {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    findings.push(`${path}: must be a positive integer`);
  }
}

function isMainModule() {
  const entry = process.argv[1];
  return Boolean(entry && resolve(entry) === fileURLToPath(import.meta.url));
}

function main() {
  let policy: unknown;
  const findings: string[] = [];
  try {
    policy = JSON.parse(readFileSync(join(process.cwd(), POLICY_PATH), "utf8"));
  } catch (error) {
    findings.push(
      `${POLICY_PATH}: unreadable or invalid JSON (${error instanceof Error ? error.message : "unknown error"})`,
    );
  }

  if (policy) findings.push(...validateSecurityAlertPolicy(policy));

  if (findings.length > 0) {
    console.error("Security alert source catalog failed:");
    for (const finding of findings) console.error(`- ${finding}`);
    process.exitCode = 1;
    return;
  }

  const typed = policy as { alerts: unknown[] };
  console.log("Security alert source catalog passed.");
  console.log(`alerts: ${typed.alerts.length}`);
  console.log("deployment: unverified");
  console.log("metricBinding: unverified");
  console.log("notificationDelivery: unverified");
  console.log("drills: unverified");
}

if (isMainModule()) main();
