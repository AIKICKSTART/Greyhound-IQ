import {
  INCIDENT_READINESS_REQUIREMENT_IDS,
  type IncidentReadinessRequirementId,
} from "./incident-readiness";

export const INCIDENT_READINESS_EVIDENCE_SCOPE =
  "documented-procedure-existence-only" as const;

export const INCIDENT_READINESS_EVIDENCE_PATHS = [
  "docs/security/incident-response.md",
  "security/incident-readiness.ts",
  "security/incident-readiness-evidence.ts",
  "security/incident-readiness-evidence.test.ts",
] as const;

export type IncidentReadinessMasterEvidenceRecord = {
  readonly status: "verified";
  readonly evidence: typeof INCIDENT_READINESS_EVIDENCE_PATHS;
};

/**
 * This evidence verifies that each required procedure is present and structurally
 * complete in the repository document. It does not prove an exercised runbook,
 * named roster, alert delivery, provider access, drill, or operational readiness.
 */
export const INCIDENT_READINESS_MASTER_EVIDENCE: Readonly<
  Record<string, IncidentReadinessMasterEvidenceRecord>
> = Object.fromEntries(
  INCIDENT_READINESS_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: INCIDENT_READINESS_EVIDENCE_PATHS,
    },
  ]),
);

export function isIncidentReadinessRequirementId(
  value: string,
): value is IncidentReadinessRequirementId {
  return (INCIDENT_READINESS_REQUIREMENT_IDS as readonly string[]).includes(
    value,
  );
}
