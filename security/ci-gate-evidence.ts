export const VERIFIED_SECURITY_CI_GATE_IDS = [
  "security.ci.02.api-missing-inventory",
  "security.ci.04.deployed-route-absent",
  "security.ci.12.unsafe-query-interpolation",
  "security.ci.13.collection-unbounded",
  "security.ci.15.destructive-action-no-audit",
  "security.ci.16.payment-webhook-no-signature",
  "security.ci.17.webhook-no-dedupe",
  "security.ci.18.billing-return-grants-entitlement",
  "security.ci.19.sensitive-action-no-csrf",
  "security.ci.20.private-response-public-cacheable",
  "security.ci.21.committed-secret",
  "security.ci.22.client-bundle-server-secret",
  "security.ci.24.infrastructure-exposes-private-datastore",
  "security.ci.28.skipped-critical-test",
  "security.ci.29.high-finding-no-owner",
  "security.ci.30.expired-risk-acceptance",
] as const;

export type VerifiedSecurityCiGateId =
  (typeof VERIFIED_SECURITY_CI_GATE_IDS)[number];

type SecurityCiGateEnforcement = {
  control: string;
  failureMode: string;
  evidence: readonly string[];
};

export const SECURITY_CI_GATE_ENFORCEMENT = {
  "security.ci.02.api-missing-inventory": {
    control:
      "Source discovery and exact-set tests bind every exported HTTP operation to the generated endpoint inventory.",
    failureMode:
      "The unit-test job exits non-zero when a discovered HTTP operation is absent from the endpoint inventory.",
    evidence: [
      ".github/workflows/ci.yml",
      "package.json",
      "scripts/run-unit-tests.ts",
      "security/endpoints.ts",
      "security/api-surface-inventory.test.ts",
      "security/registry.test.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.04.deployed-route-absent": {
    control:
      "Every src/app route.ts file must yield a discovered HTTP method and every discovery must be inventoried.",
    failureMode:
      "The unit-test job exits non-zero when a route file has no discovered operation or an operation is missing from inventory.",
    evidence: [
      ".github/workflows/ci.yml",
      "package.json",
      "scripts/run-unit-tests.ts",
      "security/endpoints.ts",
      "security/registry.test.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.12.unsafe-query-interpolation": {
    control:
      "A TypeScript AST policy inventories non-test production source and permits Prisma raw database operations only as direct tagged templates or with one direct Prisma.sql tagged template.",
    failureMode:
      "CI exits non-zero for unsafe raw APIs, Prisma.raw, plain-string raw calls, element access, aliases, destructuring, reflection or indirect invocation.",
    evidence: [
      ".github/workflows/ci.yml",
      "package.json",
      "scripts/check-production-sql-safety.ts",
      "scripts/check-production-sql-safety.test.ts",
      "security/sql-injection-control-evidence.test.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.13.collection-unbounded": {
    control:
      "An exhaustive TypeScript AST policy requires every direct production Prisma findMany and groupBy collection read to carry a statically resolved take bound between 1 and 5,000 rows.",
    failureMode:
      "The automatically discovered unit gate exits non-zero for a missing, dynamic, mutable, spread, aliased, shadowed, negative or excessive collection bound, or for an inventory bypass.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "security/collection-query-bound-evidence.ts",
      "security/collection-query-bound-evidence.test.ts",
    ],
  },
  "security.ci.15.destructive-action-no-audit": {
    control:
      "An exhaustive TypeScript AST gate discovers every direct production Prisma delete/deleteMany call, requires an exact classification, and requires each irreversible action to bind to a persisted audit event and audit write.",
    failureMode:
      "The automatically discovered unit suite exits non-zero for an unclassified production hard delete, a stale classification, a missing audit event/source binding, or an audited action without an audit write in its containing function.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "security/destructive-action-audit-coverage.ts",
      "security/destructive-action-audit-coverage.test.ts",
      "security/audit-events.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.16.payment-webhook-no-signature": {
    control:
      "The exhaustive webhook evidence discovers Stripe, Lago and LiveKit ingress and exercises each provider's exact raw-body signature rejection path.",
    failureMode:
      "The automatically discovered unit suite exits non-zero when a webhook loses its provider signature verifier or accepts a missing, stale or body-mismatched credential.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "security/webhook-control-evidence.test.ts",
      "security/webhook-runtime-control.test.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/billing/lago-webhooks.ts",
      "src/lib/livekit-admin.ts",
    ],
  },
  "security.ci.17.webhook-no-dedupe": {
    control:
      "An exhaustive webhook-route registry binds Stripe and Lago to unique receipts plus fenced reducers, and LiveKit to database compare-and-set transitions that suppress duplicate domain events.",
    failureMode:
      "The automatically discovered unit gate exits non-zero when a webhook route is unregistered, a receipt/fencing marker disappears, or a LiveKit compare-and-set guard is removed.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "security/webhook-deduplication-ci-evidence.ts",
      "security/webhook-deduplication-ci-evidence.test.ts",
      "security/webhook-control-evidence.test.ts",
      "security/billing-webhook-idempotency-evidence.test.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "src/lib/billing/lago-webhooks.ts",
      "src/lib/billing/lago-reducer.ts",
      "src/lib/call-service.ts",
      "prisma/schema.prisma",
    ],
  },
  "security.ci.18.billing-return-grants-entitlement": {
    control:
      "Checkout and portal return URLs carry display state only; paid tier changes are derived by server-side webhook settlement from allowlisted provider price and subscription state.",
    failureMode:
      "The billing readiness and settlement suites exit non-zero if checkout completion metadata or a browser return path can grant subscriptionTier or paid entitlement.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "src/lib/billing/stripe-readiness.test.ts",
      "src/lib/billing/stripe-webhook-settlement.test.ts",
      "src/lib/billing/stripe-webhooks.ts",
      "security/webhook-control-evidence.test.ts",
    ],
  },
  "security.ci.19.sensitive-action-no-csrf": {
    control:
      "The request proxy applies fail-closed Origin and Fetch Metadata validation to cookie-authenticated unsafe methods across the application matcher, including Server Actions and uploads.",
    failureMode:
      "The CSRF evidence suite exits non-zero when proxy ordering, coverage, missing-origin rejection or cross-site rejection is removed.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "src/proxy.ts",
      "src/lib/request-security.ts",
      "src/lib/request-security.test.ts",
      "security/csrf-control-evidence.test.ts",
    ],
  },
  "security.ci.20.private-response-public-cacheable": {
    control:
      "The global request boundary forces private no-store caching for authenticated API requests and mutations, while focused download and replay tests retain explicit private cache policies.",
    failureMode:
      "The HTTP evidence suite exits non-zero when Cookie/Authorization variation, private no-store enforcement or a sensitive route's explicit cache policy is removed.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "src/proxy.ts",
      "src/lib/request-security.ts",
      "security/http-control-evidence.test.ts",
    ],
  },
  "security.ci.21.committed-secret": {
    control:
      "The CI gate scans Git history with a digest-pinned Gitleaks image and propagates its exit status.",
    failureMode:
      "Gitleaks exits non-zero for a committed secret, which fails the GitHub Actions gate job.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/check-supply-chain-policy.ts",
      "scripts/check-supply-chain-policy.test.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.22.client-bundle-server-secret": {
    control:
      "After the production build, CI compares every configured server-secret value with every regular file under .next/static and reports only the identifier and file path.",
    failureMode:
      "The post-build secret-boundary step exits non-zero when a server-secret value or supported encoded variant appears in a client bundle.",
    evidence: [
      ".github/workflows/ci.yml",
      "package.json",
      "scripts/check-secret-boundaries.ts",
      "scripts/check-secret-boundaries.test.ts",
      "security/secret-control-evidence.test.ts",
    ],
  },
  "security.ci.24.infrastructure-exposes-private-datastore": {
    control:
      "The Terraform CI contract runs a GCP datastore policy that requires private Cloud SQL, AlloyDB and Memorystore networking and rejects world-open datastore firewall ports.",
    failureMode:
      "The source gate exits non-zero when a reviewed datastore resource lacks the required private boundary or a datastore port is exposed to a world route.",
    evidence: [
      ".github/workflows/ci.yml",
      "package.json",
      "infra/terraform/private-datastore-policy.mjs",
      "infra/terraform/private-datastore-policy.test.mjs",
      "infra/terraform/contract.test.mjs",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.28.skipped-critical-test": {
    control:
      "The unit runner discovers every .test.ts file under src, scripts and security, while the evidence guard requires an empty skip list.",
    failureMode:
      "The CI unit-test job exits non-zero when the skip list is populated, a test fails, or the unit-test wiring is removed.",
    evidence: [
      ".github/workflows/ci.yml",
      "package.json",
      "scripts/run-unit-tests.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.29.high-finding-no-owner": {
    control:
      "Every SEC-H finding is parsed from the risk register and must contain a non-empty owner field.",
    failureMode:
      "The security finding unit test exits non-zero when a high finding has no owner.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "docs/security/risk-register.md",
      "security/security-findings.ts",
      "security/security-findings.test.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
  "security.ci.30.expired-risk-acceptance": {
    control:
      "The evidence guard evaluates every merged temporary risk acceptance against the current time.",
    failureMode:
      "The CI unit-test job exits non-zero for a missing, invalid, or expired acceptance date.",
    evidence: [
      ".github/workflows/ci.yml",
      "scripts/run-unit-tests.ts",
      "src/components/master-audit-requirements.ts",
      "src/components/security-master-requirements.ts",
      "security/ci-gate-evidence.ts",
      "security/ci-gate-evidence.test.ts",
    ],
  },
} as const satisfies Record<
  VerifiedSecurityCiGateId,
  SecurityCiGateEnforcement
>;

export type SecurityCiMasterEvidenceRecord = {
  readonly status: "verified";
  readonly evidence: readonly string[];
};

export const SECURITY_CI_MASTER_EVIDENCE: Readonly<
  Record<VerifiedSecurityCiGateId, SecurityCiMasterEvidenceRecord>
> = {
  "security.ci.02.api-missing-inventory": masterEvidence(
    "security.ci.02.api-missing-inventory",
  ),
  "security.ci.04.deployed-route-absent": masterEvidence(
    "security.ci.04.deployed-route-absent",
  ),
  "security.ci.12.unsafe-query-interpolation": masterEvidence(
    "security.ci.12.unsafe-query-interpolation",
  ),
  "security.ci.13.collection-unbounded": masterEvidence(
    "security.ci.13.collection-unbounded",
  ),
  "security.ci.15.destructive-action-no-audit": masterEvidence(
    "security.ci.15.destructive-action-no-audit",
  ),
  "security.ci.16.payment-webhook-no-signature": masterEvidence(
    "security.ci.16.payment-webhook-no-signature",
  ),
  "security.ci.17.webhook-no-dedupe": masterEvidence(
    "security.ci.17.webhook-no-dedupe",
  ),
  "security.ci.18.billing-return-grants-entitlement": masterEvidence(
    "security.ci.18.billing-return-grants-entitlement",
  ),
  "security.ci.19.sensitive-action-no-csrf": masterEvidence(
    "security.ci.19.sensitive-action-no-csrf",
  ),
  "security.ci.20.private-response-public-cacheable": masterEvidence(
    "security.ci.20.private-response-public-cacheable",
  ),
  "security.ci.21.committed-secret": masterEvidence(
    "security.ci.21.committed-secret",
  ),
  "security.ci.22.client-bundle-server-secret": masterEvidence(
    "security.ci.22.client-bundle-server-secret",
  ),
  "security.ci.24.infrastructure-exposes-private-datastore": masterEvidence(
    "security.ci.24.infrastructure-exposes-private-datastore",
  ),
  "security.ci.28.skipped-critical-test": masterEvidence(
    "security.ci.28.skipped-critical-test",
  ),
  "security.ci.29.high-finding-no-owner": masterEvidence(
    "security.ci.29.high-finding-no-owner",
  ),
  "security.ci.30.expired-risk-acceptance": masterEvidence(
    "security.ci.30.expired-risk-acceptance",
  ),
};

export function findMissingInventoryOperations(
  discoveredOperations: readonly string[],
  inventoriedOperations: readonly string[],
) {
  const inventoried = new Set(inventoriedOperations);
  return [...new Set(discoveredOperations)]
    .filter((operation) => !inventoried.has(operation))
    .sort();
}

export function findRouteFilesWithoutOperation(
  routeFiles: readonly string[],
  discoveredSourceFiles: readonly string[],
) {
  const discovered = new Set(discoveredSourceFiles);
  return [...new Set(routeFiles)]
    .filter((file) => !discovered.has(file))
    .sort();
}

export type SecurityCiWiringInputs = {
  workflow: string;
  packageJson: string;
  unitRunner: string;
};

export function findSecurityCiWiringIssues({
  workflow,
  packageJson,
  unitRunner,
}: SecurityCiWiringInputs) {
  const issues: string[] = [];

  let manifest: { scripts?: Record<string, unknown> };
  try {
    manifest = JSON.parse(packageJson) as { scripts?: Record<string, unknown> };
  } catch {
    return ["PACKAGE_JSON_INVALID"];
  }

  if (manifest.scripts?.["test:unit"] !== "tsx scripts/run-unit-tests.ts") {
    issues.push("UNIT_SCRIPT_WIRING_MISSING");
  }
  if (!/^\s*-\s+run:\s+npm run test:unit\s*$/m.test(workflow)) {
    issues.push("WORKFLOW_UNIT_GATE_MISSING");
  }
  if (
    manifest.scripts?.["check:production-sql-safety"] !==
      "tsx scripts/check-production-sql-safety.ts" ||
    !/npm run check:production-sql-safety/.test(workflow)
  ) {
    issues.push("PRODUCTION_SQL_SAFETY_GATE_MISSING");
  }
  if (
    !/ghcr\.io\/gitleaks\/gitleaks@sha256:[a-f0-9]{64}/.test(workflow) ||
    !/\bgit \. --redact --no-banner\b/.test(workflow)
  ) {
    issues.push("GITLEAKS_HISTORY_SCAN_MISSING");
  }
  const buildOffset = workflow.indexOf("npm run build");
  const clientSecretCheckOffset = workflow.indexOf(
    "npm run check:secret-boundaries -- --built",
  );
  if (
    manifest.scripts?.["check:secret-boundaries"] !==
      "tsx scripts/check-secret-boundaries.ts" ||
    buildOffset < 0 ||
    clientSecretCheckOffset <= buildOffset
  ) {
    issues.push("CLIENT_SECRET_BUNDLE_GATE_MISSING");
  }
  if (
    manifest.scripts?.["check:security-trace-registry"] !==
      "tsx scripts/generate-security-trace-registry.ts --check" ||
    !/^\s*-\s+run:\s+npm run check:security-trace-registry\s*$/m.test(workflow)
  ) {
    issues.push("SECURITY_ENDPOINT_DOCUMENTATION_GATE_MISSING");
  }
  if (
    manifest.scripts?.["check:terraform-source"] !==
      "node infra/terraform/contract.test.mjs && node infra/terraform/private-datastore-policy.test.mjs && node infra/terraform-production/contract.test.mjs" ||
    !/npm run check:terraform-source/.test(workflow)
  ) {
    issues.push("PRIVATE_DATASTORE_EXPOSURE_GATE_MISSING");
  }
  if (
    !/\["src",\s*"scripts",\s*"security"\]\.flatMap\(findTestFiles\)/.test(
      unitRunner,
    )
  ) {
    issues.push("CRITICAL_TEST_ROOT_DISCOVERY_MISSING");
  }

  const skipList = unitRunner.match(
    /const\s+SKIP_FILES\s*:\s*string\[\]\s*=\s*\[([\s\S]*?)\];/,
  );
  if (!skipList) {
    issues.push("CRITICAL_TEST_SKIP_POLICY_MISSING");
  } else if (stripComments(skipList[1]).trim()) {
    issues.push("CRITICAL_TEST_SKIPPED");
  }

  return issues;
}

export type RiskAcceptanceRecord = {
  id: string;
  status: string;
  riskAcceptance?: {
    expiresOn?: string;
  };
};

export function findExpiredRiskAcceptanceIds(
  records: readonly RiskAcceptanceRecord[],
  now = Date.now(),
) {
  return records
    .filter((record) => record.status === "risk-accepted-temporarily")
    .filter((record) => {
      const expiresOn = record.riskAcceptance?.expiresOn;
      if (!expiresOn) return true;
      const expiry = Date.parse(expiresOn);
      return !Number.isFinite(expiry) || expiry <= now;
    })
    .map((record) => record.id)
    .sort();
}

function stripComments(value: string) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function masterEvidence(id: VerifiedSecurityCiGateId) {
  return {
    status: "verified" as const,
    evidence: SECURITY_CI_GATE_ENFORCEMENT[id].evidence,
  };
}
