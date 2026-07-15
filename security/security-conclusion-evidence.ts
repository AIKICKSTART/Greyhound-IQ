export const NO_FRONTEND_ONLY_CONCLUSION_REQUIREMENT_ID =
  "security.release.30.no-frontend-only-conclusion" as const;

export const ALLOWED_NARROW_SECURITY_VERIFICATION_SCOPES = [
  "output-existence-only",
  "final-report-structure-only",
] as const;

export type CompletedSecurityConclusionEvidence = {
  readonly id: string;
  readonly evidence: readonly string[];
  readonly verificationScope?: string;
};

const NON_FRONTEND_EVIDENCE_ROOTS = [
  ".github/",
  "external/",
  "infra/",
  "prisma/",
  "scripts/",
  "security/",
  "src/app/api/",
  "src/lib/",
] as const;

const NON_FRONTEND_SOURCE_FILES = new Set([
  "Dockerfile",
  "cloudbuild.yaml",
  "next.config.ts",
  "package-lock.json",
  "package.json",
  "src/components/design-lab-architecture-inventory.test.ts",
  "src/components/design-lab-route-safety.test.ts",
  "src/components/security-required-input-evidence.test.ts",
  "src/instrumentation.ts",
  "src/proxy.ts",
  "tsconfig.json",
  "vercel.json",
]);

/**
 * Returns completed conclusions that have neither a deliberately narrow scope
 * nor evidence outside browser-rendered UI behavior.
 *
 * The caller owns completion semantics. Keeping that decision outside this
 * module avoids coupling this fail-closed evidence classifier to the merged
 * master registry that consumes its evidence record.
 */
export function findFrontendOnlyCompletedSecurityConclusionIds(
  conclusions: readonly CompletedSecurityConclusionEvidence[],
) {
  return conclusions
    .filter((conclusion) => {
      if (conclusion.evidence.length === 0) return true;
      if (hasAllowedNarrowVerificationScope(conclusion.verificationScope)) {
        return false;
      }
      return !conclusion.evidence.some(isNonFrontendSecurityEvidencePath);
    })
    .map(({ id }) => id)
    .toSorted();
}

export function isNonFrontendSecurityEvidencePath(path: string) {
  const normalized = path.replaceAll("\\", "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("../")) {
    return false;
  }
  if (NON_FRONTEND_SOURCE_FILES.has(normalized)) return true;
  if (NON_FRONTEND_EVIDENCE_ROOTS.some((root) => normalized.startsWith(root))) {
    return true;
  }
  return /src\/app\/(?:[^/]+\/)*route\.ts$/.test(normalized);
}

function hasAllowedNarrowVerificationScope(scope: string | undefined) {
  return ALLOWED_NARROW_SECURITY_VERIFICATION_SCOPES.some(
    (allowed) => scope === allowed,
  );
}

const NO_FRONTEND_ONLY_CONCLUSION_EVIDENCE = [
  "security/security-conclusion-evidence.ts",
  "security/security-conclusion-evidence.test.ts",
  "security/security-language-policy.ts",
  "security/security-language-policy-evidence.ts",
  "security/security-language-policy.test.ts",
  "src/components/master-audit-evidence.ts",
  "src/components/master-audit-requirements.ts",
] as const;

export const NO_FRONTEND_ONLY_CONCLUSION_MASTER_EVIDENCE = {
  [NO_FRONTEND_ONLY_CONCLUSION_REQUIREMENT_ID]: {
    status: "verified" as const,
    evidence: NO_FRONTEND_ONLY_CONCLUSION_EVIDENCE,
  },
} as const;
