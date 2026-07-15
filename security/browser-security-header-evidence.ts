export const VERIFIED_BROWSER_SECURITY_HEADER_IDS = [
  "security.browser-security-header.csp",
  "security.browser-security-header.frame-ancestors",
  "security.browser-security-header.hsts",
  "security.browser-security-header.nosniff",
  "security.browser-security-header.referrer",
  "security.browser-security-header.permissions",
  "security.browser-security-header.cross-origin",
  "security.browser-security-header.cache",
  "security.browser-security-header.cookie",
  "security.browser-security-header.meaningful-csp",
] as const;

const BROWSER_SECURITY_HEADER_EVIDENCE = [
  "next.config.ts",
  "src/proxy.ts",
  "src/lib/csp.ts",
  "src/lib/workos-env.ts",
  "src/lib/workos-env.test.ts",
  ".env.example",
  "package-lock.json",
  "security/browser-security-header-evidence.test.ts",
] as const;

export const BROWSER_SECURITY_HEADER_MASTER_EVIDENCE = Object.fromEntries(
  VERIFIED_BROWSER_SECURITY_HEADER_IDS.map((requirementId) => [
    requirementId,
    {
      status: "verified" as const,
      evidence: BROWSER_SECURITY_HEADER_EVIDENCE,
    },
  ]),
);
