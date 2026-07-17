# GreyhoundIQ supply-chain review

Status: conditional; current source and lockfile only  
Review date: 2026-07-15  
Owner role: Platform and application security

## Source-bound checks passed in the latest local run

- `package-lock.json` uses lockfile version 3 and currently inventories 923 non-root lock entries: 29 direct runtime dependencies and 11 direct development dependencies. Those entries collapse to 876 unique package-name/version identities in npm's SBOM model.
- The root manifest and lockfile dependency groups are compared independent of JSON property order. npm workspaces, npm aliases, URL, Git, SSH, local file and link specifiers, and lockfile link entries are rejected.
- Every non-root lock entry must have a version, an exact HTTPS distribution URL on `registry.npmjs.org`, and a valid SHA-512 integrity value. This is source and integrity metadata validation; it is not a review of package behaviour.
- The CI `gate` job must install with the exact `npm ci` command before the exact `npm run check:supply-chain` command. The structural policy ignores matching text in comments and other jobs and rejects `npm install` in the gate job.
- The lockfile-derived CycloneDX 1.5 application SBOM is checked in memory. All 876 unique lock identities must have matching name, version, package URL, SHA-512 hash and distribution URL, and all 877 dependency nodes must use known component references.
- The policy queries the npm advisory service through the approved npm registry and fails closed on an incomplete schema, inconsistent counts, a non-zero command exit, or any high or critical finding. The 2026-07-14 local run reported zero info, low, moderate, high or critical known advisories.
- The Gitleaks and Semgrep container references in the CI `gate` job must use exact 64-hex SHA-256 digests. Their findings remain separate controls from dependency advisories.
- All 13 third-party `uses:` references across the repository workflows are pinned to full 40-hex commit SHAs. The policy rejects mutable tags, branches, short SHAs and missing revisions in every workflow file; the adjacent comments retain the reviewed major-version intent for maintainers.
- `security/supply-chain-review.snapshot.json` records official npm registry metadata for all 41 direct dependencies and is cryptographically bound to the complete `package-lock.json` package inventory. The policy rejects an older-than-31-day review, a changed lock tree, missing direct package, deprecated direct package, unowned package publication, or unreviewed stale package.
- Every current lifecycle hook is allowlisted by package name, exact version and exact hook command. A new `hasInstallScript` package, changed version or changed published hook fails the review. The root `postinstall` is separately pinned to `prisma generate`.
- The dependency review snapshot is bound to the complete lockfile package inventory and expires after 31 days.

## Important limitation

A clean advisory scan is not proof that the application or supply chain is secure. It cannot identify an unpublished vulnerability, a malicious release with no advisory, a compromised registry or maintainer, unsafe lifecycle-script behaviour, a vulnerable OS package in the built image, or an application flaw in GreyhoundIQ code.

The SBOM is generated and validated during the gate but is not yet retained, signed or attached to an immutable release artifact. Therefore the broader SBOM, artifact-provenance and release-signing requirements remain open.

The policy runs after `npm ci`, so it cannot prevent lifecycle scripts from executing during that install.

Required-status branch protection was not inspected, so workflow presence is not proof that the gate cannot be bypassed.

The npm CLI version used for SBOM generation and advisory queries is not pinned by this policy.

## Lifecycle-script review

The root `postinstall` command runs the reviewed `prisma generate` code-generation step. Eight lockfile packages currently declare lifecycle hooks: `@prisma/client`, `@prisma/engines`, `@scarf/scarf`, `esbuild`, `fsevents`, `prisma`, `sharp`, and `unrs-resolver`. Their exact hook commands, versions, purpose and dispositions are recorded in `security/supply-chain-dependency-review.ts` and verified against official registry manifests during review capture. `@scarf/scarf` is network-capable, so `package.json` explicitly sets `scarfSettings.enabled` to `false` and the policy rejects removal or reversal of that setting. Install-script and post-install-script review is complete; pre-execution malicious-package containment remains a separate open control because this gate runs after installation.

## Maintenance, duplicate and runtime review

- All 41 direct packages were reviewed against official npm registry metadata on 2026-07-17. No direct locked package is marked deprecated. A direct package with no maintainer or publisher fails the policy.
- Registry metadata older than 730 days requires an explicit stable-package disposition. Current reviewed exceptions are the `server-only` framework sentinel, the stable `clsx` leaf utility, and the development-only OWASP Spectral ruleset. An exception is not a permanent waiver; it is re-reviewed with each snapshot refresh.
- The current lock contains 76 package names at more than one version: 21 have at least one runtime instance and 55 are development-only. Every name, version, instance count and runtime classification is recorded in the lock-bound snapshot. This is reviewed compatibility and attack-surface debt, not a claim that duplication is harmless.
- Three deprecated packages remain, all development-only transitives in the Spectral ruleset bundling chain: `glob@7.2.3`, `inflight@1.0.6`, and `sourcemap-codec@1.4.8`. They are excluded from the standalone production runtime and tracked for upstream replacement. A deprecated runtime-tree package fails the policy.
- All 30 manifest `dependencies` entries have an explicit disposition. Twenty-five are application runtime dependencies; `@next/env`, `prisma`, and `tsx` are build or operations-only; `@auth/prisma-adapter` and `next-auth` are currently unused removal debt. Unused or build-only runtime dependencies remain removal debt; review completion does not claim they are necessary at runtime.

## Package-name and internal publishing review

GreyhoundIQ is one private npm package with no internal publishing path. The manifest is `private`, has no workspace or `publishConfig`, and all dependency sources must resolve to exact integrity-protected artifacts on the approved public registry. There is no internal scope, linked package or publish pipeline that could be confused with an unclaimed public package name. If an internal package is introduced, this not-applicable decision expires and private registry namespace reservation plus authenticated publishing controls become mandatory.

## Residual risks and launch blockers

| Risk | Current containment | Required closure | Launch blocker |
| --- | --- | --- | --- |
| Every third-party GitHub Action reference is pinned to an immutable full commit SHA. | Repository-wide fail-closed policy plus reviewable major-version comments | Re-resolve and review upstream commits deliberately during dependency maintenance | No |
| The container base image is selected by a mutable tag rather than an immutable digest. | Minimal Debian image, non-root runtime user | Pin a reviewed digest, rebuild on security updates, and scan the final image | Yes |
| No retained release SBOM or provenance attestation | Lockfile-derived SBOM validation in CI | Retain CycloneDX output and bind it to the deployed image digest | Yes |
| No independent container/SBOM cross-validation | npm advisory scan | Add a free scanner such as Grype or Trivy and fail on high/critical findings | Yes |
| Lifecycle scripts execute during `npm ci` | Exact hook/version allowlist, lock integrity, reviewed dispositions and Scarf opt-out | Add a pre-install artifact verification or sandbox stage for proactive malicious-package containment | Yes, for the separate malicious-package control |
| The CI PostgreSQL service uses the mutable `postgres:16` tag | Isolated CI service with synthetic credentials | Pin the reviewed service image digest and define the update procedure | Yes |
| The npm CLI version is inherited from the runner/toolchain | SBOM schema and content are validated fail-closed | Pin and review the npm CLI version used by the gate | Yes |
| Required-status branch protection is unverified | Gate is present in the repository workflow | Verify repository rulesets require the exact gate for protected branches | Yes |
| Advisory coverage is incomplete even with current maintenance review | Fresh lock-bound registry review plus high/critical npm gate | Add patch SLAs, CISA KEV review and license policy | Yes |

## Operator procedure

Run `npm run review:supply-chain` after every dependency or lockfile change and at least every 31 days; this refreshes the official-registry snapshot and fails on unreviewed lifecycle hooks, deprecated direct dependencies or stale packages without a disposition. Then run `npm run check:supply-chain`. The check validates manifest/lock parity, the lock-bound review, dependency sources, CI enforcement and this document; generates and validates a CycloneDX SBOM; then queries the npm advisory service. A non-zero result is release-blocking. Do not bypass the gate by lowering its severity or editing expected counts; remediate, replace, remove or explicitly review the affected dependency.
