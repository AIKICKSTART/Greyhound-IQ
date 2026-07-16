import { readFileSync } from "node:fs";
import path from "node:path";

export const SECURITY_FINDING_FIELD_LABELS = {
  findingId: "Finding ID",
  title: "Title",
  severity: "Severity",
  affectedTraceIds: "Affected trace IDs",
  affectedEnvironments: "Affected environments",
  affectedActors: "Affected actors",
  affectedRecords: "Affected records",
  dataClassification: "Data classification",
  sourceFile: "Source file",
  sourceSymbol: "Source symbol",
  endpoint: "Endpoint",
  databaseOperation: "Database operation",
  description: "Description",
  actualBehaviour: "Actual behaviour",
  expectedBehaviour: "Expected behaviour",
  attackPreconditions: "Attack preconditions",
  businessImpact: "Business impact",
  privacyImpact: "Privacy impact",
  evidence: "Evidence",
  rootCause: "Root cause",
  immediateContainment: "Immediate containment",
  permanentRemediation: "Permanent remediation",
  regressionTests: "Regression tests",
  owner: "Owner",
  targetDate: "Target date",
  status: "Status",
  residualRisk: "Residual risk",
  retestEvidence: "Retest evidence",
} as const;

export type SecurityFinding = Readonly<
  Record<keyof typeof SECURITY_FINDING_FIELD_LABELS, string>
>;

export function loadSecurityFindings(repositoryRoot = process.cwd()) {
  const source = readFileSync(
    path.join(repositoryRoot, "docs/security/risk-register.md"),
    "utf8",
  );
  const headings = [
    ...source.matchAll(/^## `(SEC-H-\d{3})`\s+[—-]\s+.+$/gm),
  ];

  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? source.length;
    const section = source.slice(start, end);
    const rows = new Map<string, string>();
    for (const line of section.split(/\r?\n/)) {
      const match = line.match(/^\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|$/);
      if (match) rows.set(match[1].trim(), match[2].trim());
    }

    const entries = Object.entries(SECURITY_FINDING_FIELD_LABELS).map(
      ([field, label]) => {
        const value = rows.get(label);
        if (!value) throw new Error(`${heading[1] ?? "finding"}: missing ${label}`);
        return [field, value] as const;
      },
    );
    return Object.fromEntries(entries) as SecurityFinding;
  });
}

export function validateSecurityFindings(findings: readonly unknown[]) {
  const failures: string[] = [];
  const findingIds = new Set<string>();

  for (const candidate of findings) {
    if (!candidate || typeof candidate !== "object") {
      failures.push("finding:not-an-object");
      continue;
    }
    const finding = candidate as Record<string, unknown>;
    const findingId =
      typeof finding.findingId === "string" && finding.findingId.trim()
        ? finding.findingId.replaceAll("`", "")
        : "finding";
    for (const field of Object.keys(SECURITY_FINDING_FIELD_LABELS)) {
      if (
        !Object.hasOwn(finding, field) ||
        typeof finding[field] !== "string" ||
        !finding[field].trim()
      ) {
        failures.push(`${findingId}:${field}`);
      }
    }
    if (findingIds.has(findingId)) failures.push(`${findingId}:duplicate`);
    findingIds.add(findingId);
  }

  return failures;
}
