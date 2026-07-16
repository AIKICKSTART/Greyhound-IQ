const HEALTH_REDACTION_EVIDENCE = [
  "src/app/api/health/route.ts",
  "src/app/api/health/billing/route.ts",
  "src/app/api/health/feeds/route.ts",
  "src/app/api/health/ready/route.ts",
  "src/app/api/health/ready/route.test.ts",
  "security/health-endpoint-redaction-evidence.test.ts",
] as const;

export const HEALTH_ENDPOINT_REDACTION_MASTER_EVIDENCE = {
  "security.api-inventory-management.health-redact": {
    status: "verified" as const,
    evidence: HEALTH_REDACTION_EVIDENCE,
  },
};

