import type { PersonalInformationRecord } from "./personal-information-records";

export const PRIVACY_MINIMISATION_REVIEW_DATE = "2026-07-15" as const;

export type PrivacyMinimisationDecision = {
  readonly recordId: string;
  readonly sourceReference: string;
  readonly statedPurpose: string;
  readonly collectionRule:
    | "required-for-persisted-record"
    | "optional-feature-value"
    | "provider-feature-invocation-only";
  readonly futureUsePermitted: false;
  readonly secondaryAnalyticsUse: "prohibited-by-default";
  readonly secondaryAiUse: "prohibited-by-default";
  readonly owner: string;
};

export function buildPrivacyMinimisationDecisions(
  records: readonly PersonalInformationRecord[],
): PrivacyMinimisationDecision[] {
  return records
    .map((record) => ({
      recordId: record.recordId,
      sourceReference: record.sourceReference,
      statedPurpose: record.purpose,
      collectionRule:
        record.sourceKind === "third-party"
          ? ("provider-feature-invocation-only" as const)
          : record.requiredOrOptionalStatus === "schema-required"
            ? ("required-for-persisted-record" as const)
            : ("optional-feature-value" as const),
      futureUsePermitted: false as const,
      secondaryAnalyticsUse: "prohibited-by-default" as const,
      secondaryAiUse: "prohibited-by-default" as const,
      owner: record.dataOwner,
    }))
    .sort((left, right) => left.recordId.localeCompare(right.recordId));
}

export function validatePrivacyMinimisationDecisions(
  records: readonly PersonalInformationRecord[],
  decisions: readonly PrivacyMinimisationDecision[],
) {
  const recordsById = new Map(records.map((record) => [record.recordId, record]));
  const seen = new Set<string>();
  const issues: string[] = [];

  for (const decision of decisions) {
    if (seen.has(decision.recordId)) issues.push(`DUPLICATE:${decision.recordId}`);
    seen.add(decision.recordId);
    const record = recordsById.get(decision.recordId);
    if (!record) {
      issues.push(`UNEXPECTED:${decision.recordId}`);
      continue;
    }
    if (decision.sourceReference !== record.sourceReference) {
      issues.push(`SOURCE_DRIFT:${decision.recordId}`);
    }
    if (decision.statedPurpose !== record.purpose) {
      issues.push(`PURPOSE_DRIFT:${decision.recordId}`);
    }
    if (
      /\b(?:future|maybe|potential|later|tbd|unknown|just in case)\b/i.test(
        decision.statedPurpose,
      )
    ) {
      issues.push(`FUTURE_USE_PURPOSE:${decision.recordId}`);
    }
    const expectedRule =
      record.sourceKind === "third-party"
        ? "provider-feature-invocation-only"
        : record.requiredOrOptionalStatus === "schema-required"
          ? "required-for-persisted-record"
          : "optional-feature-value";
    if (decision.collectionRule !== expectedRule) {
      issues.push(`COLLECTION_RULE_DRIFT:${decision.recordId}`);
    }
    if (decision.futureUsePermitted !== false) {
      issues.push(`FUTURE_USE_ALLOWED:${decision.recordId}`);
    }
    if (
      decision.secondaryAnalyticsUse !== "prohibited-by-default" ||
      decision.secondaryAiUse !== "prohibited-by-default"
    ) {
      issues.push(`SECONDARY_USE_ALLOWED:${decision.recordId}`);
    }
    if (!decision.owner.trim()) issues.push(`OWNER_MISSING:${decision.recordId}`);
  }

  for (const record of records) {
    if (!seen.has(record.recordId)) issues.push(`MISSING:${record.recordId}`);
  }
  return issues.sort();
}
