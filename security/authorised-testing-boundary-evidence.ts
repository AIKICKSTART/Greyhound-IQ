export type AuthorisedTestingBoundaryControl = {
  readonly requirementId: `security.authorised-testing-boundary.${string}`;
  readonly control: string;
  readonly enforcement: string;
  readonly evidence: readonly string[];
  readonly residualBoundary: string;
};

const SHARED_EVIDENCE = [
  "AGENTS.md",
  ".github/workflows/ci.yml",
  "scripts/staging-load-policy.ts",
  "scripts/staging-load-policy.test.ts",
  "scripts/check-demo-route-fixture-idempotency.ts",
  "scripts/lago-webhook-replay.ts",
  "security/local-data-policy.ts",
  "security/browser-data-handling-evidence.ts",
  "security/ci-gate-evidence.ts",
  "security/authorised-testing-boundary-evidence.ts",
  "security/authorised-testing-boundary-evidence.test.ts",
] as const;

export const AUTHORISED_TESTING_BOUNDARY_CONTROLS = [
  control(
    "intrusive-scope",
    "Intrusive tests are limited to literal loopback or exact allowlisted GreyhoundIQ staging hosts.",
    "resolveStagingLoadBaseUrl and the disposable database verifier reject every other target before traffic or a transaction.",
  ),
  control(
    "no-production-load",
    "Concurrent, spike, saturation, media and realtime probes must never target production.",
    "The load-policy allowlist rejects GreyhoundIQ production domains and production Cloud Run names without an override switch.",
  ),
  control(
    "no-real-credential-attacks",
    "Repository test tooling must not perform credential attacks against real users.",
    "The CI guard scans owned test tooling for credential-attack binaries, password lists and production credential-target switches.",
  ),
  control(
    "no-private-data-extraction",
    "Security verification must not extract real private information into fixtures or evidence.",
    "The Design Lab data policy denies production database copies for every Prisma model and requires synthetic/private records to use deterministic demo identities.",
  ),
  control(
    "no-production-secret-docs",
    "Production credentials, tokens and secret values must not enter repository documentation or evidence.",
    "Digest-pinned Gitleaks scans complete Git history in CI, and the evidence guard verifies that fail-closed wiring.",
  ),
  control(
    "no-production-session-storage",
    "Production sessions and authentication tokens must not be persisted by browser or repository test tooling.",
    "The browser persistence inventory contains only consent/help preferences and rejects sessionStorage, IndexedDB and service-worker caches.",
  ),
  control(
    "no-production-destructive-query",
    "Destructive database verification is restricted to the explicitly confirmed disposable loopback replay database.",
    "assertDemoFixtureVerifierTarget requires 127.0.0.1/::1, port 55734, database greyhoundiq, runtime role, no password and exact confirmation.",
  ),
  control(
    "no-live-malware-upload",
    "Malware and unsafe-file tests must use inert fixtures in an isolated environment, never a public target.",
    "Owned security/load tooling contains no malware sample or public malware-upload runner; media load requests are constrained by the staging host allowlist.",
  ),
  control(
    "no-live-payment-replay",
    "Real payment events must not be replayed against production.",
    "The Lago replay command is a mandatory --dry-run inspector with database mutations and provider calls explicitly absent.",
  ),
  control(
    "no-private-fixtures",
    "Live customer messages, files, accounts and billing rows must not become Design Lab fixtures.",
    "Every model denies production database copy; private domains are SYNTHETIC_ONLY with .test identities and demo-* keys.",
  ),
  control(
    "no-weakened-controls",
    "Testing must not introduce production bypass flags, disabled TLS verification or weakened authentication.",
    "The repository safety scan rejects known production-override and TLS/auth bypass switches in owned test tooling.",
  ),
  control(
    "safe-production-confirmation",
    "Production confirmation is limited to safe read-only configuration, sanitized telemetry or an explicitly approved account.",
    "The only provider replay utility is read-only and dry-run; mutation/load/database proof remains constrained to staging or disposable loopback.",
  ),
] as const satisfies readonly AuthorisedTestingBoundaryControl[];

export const AUTHORISED_TESTING_BOUNDARY_EVIDENCE_SCOPE =
  "Repository-owned testing controls only. This evidence does not authorize a future test, prove operator compliance outside the repository, or permit disruptive production activity.";

export const AUTHORISED_TESTING_BOUNDARY_MASTER_EVIDENCE = Object.fromEntries(
  AUTHORISED_TESTING_BOUNDARY_CONTROLS.map(({ requirementId }) => [
    requirementId,
    { status: "verified" as const, evidence: SHARED_EVIDENCE },
  ]),
);

function control(
  suffix: string,
  statement: string,
  enforcement: string,
): AuthorisedTestingBoundaryControl {
  return {
    requirementId: `security.authorised-testing-boundary.${suffix}`,
    control: statement,
    enforcement,
    evidence: SHARED_EVIDENCE,
    residualBoundary:
      "Future execution still requires explicit authorization, target confirmation and evidence review.",
  };
}
