import { SECURITY_LANGUAGE_POLICY_IDS } from "./security-language-policy";
import { NO_FRONTEND_ONLY_CONCLUSION_MASTER_EVIDENCE } from "./security-conclusion-evidence";

const SECURITY_LANGUAGE_POLICY_EVIDENCE = [
  "security/shared.ts",
  "security/security-language-policy.ts",
  "security/security-language-policy.test.ts",
  "docs/security/security-architecture.md",
  "docs/security/release-security-report.md",
] as const;

type SecurityLanguagePolicyMasterEvidenceRecord = {
  readonly status: "verified";
  readonly evidence: readonly string[];
};

export const SECURITY_LANGUAGE_POLICY_MASTER_EVIDENCE: Readonly<
  Record<string, SecurityLanguagePolicyMasterEvidenceRecord>
> = {
  ...Object.fromEntries(
    SECURITY_LANGUAGE_POLICY_IDS.map((id) => [
      id,
      {
        status: "verified" as const,
        evidence: SECURITY_LANGUAGE_POLICY_EVIDENCE,
      },
    ]),
  ),
  ...NO_FRONTEND_ONLY_CONCLUSION_MASTER_EVIDENCE,
};
