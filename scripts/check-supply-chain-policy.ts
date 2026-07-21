import { readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import {
  APPROVED_STABLE_PACKAGE_EXCEPTIONS,
  INTERNAL_PACKAGE_PUBLISHING_JUSTIFICATION,
  PACKAGE_MAINTENANCE_MAX_AGE_DAYS,
  REVIEWED_DEPRECATED_TRANSITIVE_PACKAGES,
  REVIEWED_LIFECYCLE_SCRIPTS,
  REVIEWED_ROOT_POSTINSTALL,
  RUNTIME_DEPENDENCY_CLASSIFICATION,
  SUPPLY_CHAIN_REVIEW_MAX_AGE_DAYS,
  SUPPLY_CHAIN_REVIEW_SCHEMA_VERSION,
} from "../security/supply-chain-dependency-review";

type JsonObject = Record<string, unknown>;

const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const APPROVED_NPM_REGISTRY = "https://registry.npmjs.org";
const FORBIDDEN_DEPENDENCY_SPEC =
  /^(?:https?|git(?:\+[^:]+)?|github|gitlab|bitbucket|file|link|npm|ssh|workspace):|^(?:git@)/i;

const REQUIRED_REVIEW_STATEMENTS = [
  "A clean advisory scan is not proof that the application or supply chain is secure.",
  "Every third-party GitHub Action reference is pinned to an immutable full commit SHA.",
  "The container base image is selected by a mutable tag rather than an immutable digest.",
  "The policy runs after `npm ci`, so it cannot prevent lifecycle scripts from executing during that install.",
  "Required-status branch protection was not inspected, so workflow presence is not proof that the gate cannot be bypassed.",
  "The npm CLI version used for SBOM generation and advisory queries is not pinned by this policy.",
  "Every current lifecycle hook is allowlisted by package name, exact version and exact hook command.",
  "The dependency review snapshot is bound to the complete lockfile package inventory and expires after 31 days.",
  "GreyhoundIQ is one private npm package with no internal publishing path.",
  "Unused or build-only runtime dependencies remain removal debt; review completion does not claim they are necessary at runtime.",
] as const;

const VULNERABILITY_KEYS = [
  "info",
  "low",
  "moderate",
  "high",
  "critical",
] as const;

export type LockComponentExpectation = {
  name: string;
  version: string;
  resolved: string;
  integrityHex: string;
  purl: string;
};

export type SupplyChainSummary = {
  lockEntries: number;
  directRuntimeDependencies: number;
  directDevelopmentDependencies: number;
  uniqueLockComponents: number;
  sbomComponents: number;
  sbomDependencyNodes: number;
  pinnedActions: number;
  reviewedDirectDependencies: number;
  reviewedLifecyclePackages: number;
  duplicateLibraryFamilies: number;
  deprecatedDevelopmentPackages: number;
  vulnerabilities: Record<string, number>;
};

export type SupplyChainReviewSnapshot = {
  schemaVersion: number;
  reviewDate: string;
  registrySource: string;
  lockReviewHash: string;
  directDependencies: Array<{
    name: string;
    group: string;
    declaredSpecifier: string;
    lockedVersion: string;
    latestVersion: string;
    registryModifiedAt: string;
    deprecated: string | null;
    maintainers: number;
    publisher: string | null;
    repository: string | null;
  }>;
  lifecycleScripts: Array<{
    name: string;
    version: string;
    hooks: Record<string, string>;
  }>;
  duplicateLibraries: Array<{
    name: string;
    versions: Array<{
      version: string;
      instances: number;
      runtimeIncluded: boolean;
    }>;
  }>;
  deprecatedLockEntries: Array<{
    name: string;
    version: string;
    devOnly: boolean;
    message: string;
  }>;
};

export function assertManifestLockPolicy(
  manifest: JsonObject,
  lockfile: JsonObject,
) {
  if (lockfile.lockfileVersion !== 3) {
    throw new Error("package-lock.json must use lockfileVersion 3.");
  }

  if (Object.prototype.hasOwnProperty.call(manifest, "workspaces")) {
    throw new Error("npm workspaces are outside the approved single-package policy.");
  }

  const packages = asObject(lockfile.packages, "package-lock packages");
  const root = asObject(packages[""], "package-lock root package");

  for (const group of DEPENDENCY_GROUPS) {
    const declared = stringMap(manifest[group]);
    const locked = stringMap(root[group]);
    if (JSON.stringify(declared) !== JSON.stringify(locked)) {
      throw new Error(`${group} in package.json and package-lock.json differ.`);
    }

    for (const [name, specifier] of Object.entries(declared)) {
      if (FORBIDDEN_DEPENDENCY_SPEC.test(specifier.trim())) {
        throw new Error(
          `${group}.${name} uses a forbidden URL, Git, SSH, file, link, npm alias or workspace specifier.`,
        );
      }
    }
  }

  for (const [path, value] of Object.entries(packages)) {
    if (!path) continue;
    const record = asObject(value, `lock entry ${path}`);
    if (record.link === true) {
      throw new Error(`${path} is a local or workspace link.`);
    }
    if (typeof record.version !== "string" || !record.version) {
      throw new Error(`${path} has no immutable version.`);
    }
    if (typeof record.resolved !== "string" || !record.resolved) {
      throw new Error(`${path} has no resolved package URL.`);
    }
    if (!isApprovedRegistryUrl(record.resolved)) {
      throw new Error(`${path} resolves outside the approved npm registry.`);
    }
    parseSha512Integrity(record.integrity, path);
  }

  const uniqueLockComponents = collectLockComponentExpectations(lockfile).size;

  return {
    lockEntries: Object.keys(packages).length - 1,
    directRuntimeDependencies: Object.keys(
      stringMap(manifest.dependencies),
    ).length,
    directDevelopmentDependencies: Object.keys(
      stringMap(manifest.devDependencies),
    ).length,
    uniqueLockComponents,
  };
}

export function assertPackageScripts(manifest: JsonObject) {
  const scripts = stringMap(manifest.scripts);
  if (
    scripts["check:supply-chain"] !==
    "tsx scripts/check-supply-chain-policy.ts"
  ) {
    throw new Error("package.json must expose the canonical check:supply-chain command.");
  }
  if (!/(?:^|&&\s*)npm run check:supply-chain(?:\s*&&|$)/.test(scripts.ci ?? "")) {
    throw new Error("package.json ci must invoke check:supply-chain.");
  }
}

export function assertCiSupplyChainPolicy(workflow: string) {
  const gate = extractWorkflowJob(workflow, "gate");
  const lines = gate.split(/\r?\n/);
  const npmCiIndex = lines.findIndex(
    (line) => line.trim() === "- run: npm ci",
  );
  const policyIndex = lines.findIndex(
    (line) => line.trim() === "run: npm run check:supply-chain" ||
      line.trim() === "- run: npm run check:supply-chain",
  );
  if (npmCiIndex < 0) {
    throw new Error("CI gate job must run the exact npm ci command.");
  }
  if (policyIndex < 0) {
    throw new Error("CI gate job must run the exact check:supply-chain command.");
  }
  if (npmCiIndex >= policyIndex) {
    throw new Error("CI gate job must install before running check:supply-chain.");
  }
  if (
    lines.some(
      (line) =>
        !line.trimStart().startsWith("#") &&
        /\bnpm\s+(?:install|i)\b/.test(line),
    )
  ) {
    throw new Error("CI gate job must use npm ci rather than npm install.");
  }

  const exactImages = [
    /^ghcr\.io\/gitleaks\/gitleaks@sha256:[a-f0-9]{64}(?:\s+\\)?$/,
    /^semgrep\/semgrep@sha256:[a-f0-9]{64}(?:\s+\\)?$/,
    /^hashicorp\/terraform@sha256:[a-f0-9]{64}(?:\s+\\)?$/,
  ];
  for (const image of exactImages) {
    if (!lines.some((line) => image.test(line.trim()))) {
      throw new Error(`CI gate job is missing immutable tool image ${image}.`);
    }
  }
}

export function assertWorkflowActionPins(
  workflows: Readonly<Record<string, string>>,
) {
  let pinnedActions = 0;
  for (const [file, workflow] of Object.entries(workflows)) {
    for (const [index, line] of workflow.split(/\r?\n/).entries()) {
      const normalizedLine = line.replace(
        /\\(?:x([a-f0-9]{2})|u([a-f0-9]{4})|U([a-f0-9]{8}))/gi,
        (sequence, x: string | undefined, u: string | undefined, bigU: string | undefined) => {
          const codePoint = Number.parseInt(x ?? u ?? bigU ?? "", 16);
          return Number.isInteger(codePoint) && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : sequence;
        },
      );
      const trimmed = normalizedLine.trimStart();
      if (trimmed.startsWith("#")) continue;

      if (
        /^\s*(?:-\s*)?\?\s*(?:uses|"uses"|'uses')\s*$/.test(
          normalizedLine,
        )
      ) {
        throw new Error(
          `${file}:${index + 1} uses unsupported explicit action syntax.`,
        );
      }

      const match = normalizedLine.match(
        /^\s*(?:-\s*)?(?:uses|"uses"|'uses')\s*:\s*(.*?)\s*$/,
      );
      if (!match) {
        if (
          /^\s*-\s*\{.*(?:uses|"uses"|'uses')\s*:/.test(normalizedLine)
        ) {
          throw new Error(
            `${file}:${index + 1} uses unsupported inline action syntax.`,
          );
        }
        continue;
      }

      const scalar = match[1];
      if (/^[>|][+-]?(?:\s+#.*)?$/.test(scalar)) {
        throw new Error(
          `${file}:${index + 1} must use one literal action reference.`,
        );
      }
      const reference =
        scalar.match(/^"([^"]+)"(?:\s+#.*)?$/)?.[1] ??
        scalar.match(/^'([^']+)'(?:\s+#.*)?$/)?.[1] ??
        scalar.match(/^([^\s#]+)(?:\s+#.*)?$/)?.[1];
      if (!reference) {
        throw new Error(
          `${file}:${index + 1} must use one literal action reference.`,
        );
      }
      if (reference.startsWith("./")) continue;
      const separator = reference.lastIndexOf("@");
      const action = separator < 0 ? reference : reference.slice(0, separator);
      const revision = separator < 0 ? "" : reference.slice(separator + 1);
      if (!action || !/^[a-f0-9]{40}$/i.test(revision)) {
        throw new Error(
          `${file}:${index + 1} must pin ${action || reference} to a full 40-hex commit SHA.`,
        );
      }
      pinnedActions += 1;
    }
  }
  return pinnedActions;
}

export function assertSupplyChainReview(review: string) {
  for (const statement of REQUIRED_REVIEW_STATEMENTS) {
    if (!review.includes(statement)) {
      throw new Error(`Supply-chain review missing required statement: ${statement}`);
    }
  }
}

export function lockReviewHash(lockfile: JsonObject) {
  const packages = asObject(lockfile.packages, "package-lock packages");
  return createHash("sha256").update(canonicalJson(packages)).digest("hex");
}

export function collectLifecycleScriptPackages(lockfile: JsonObject) {
  const packages = asObject(lockfile.packages, "package-lock packages");
  return Object.entries(packages)
    .filter(([path, value]) => {
      if (!path) return false;
      return asObject(value, `lock entry ${path}`).hasInstallScript === true;
    })
    .map(([path, value]) => {
      const record = asObject(value, `lock entry ${path}`);
      return {
        name: packageNameFromLockPath(path),
        version: requiredString(record.version, `${path} version`),
      };
    })
    .sort(compareNameVersion);
}

export function collectDeprecatedLockEntries(lockfile: JsonObject) {
  const packages = asObject(lockfile.packages, "package-lock packages");
  return Object.entries(packages)
    .filter(([path, value]) => {
      if (!path) return false;
      return typeof asObject(value, `lock entry ${path}`).deprecated === "string";
    })
    .map(([path, value]) => {
      const record = asObject(value, `lock entry ${path}`);
      return {
        name: packageNameFromLockPath(path),
        version: requiredString(record.version, `${path} version`),
        devOnly: record.dev === true,
        message: requiredString(record.deprecated, `${path} deprecation`),
      };
    })
    .sort(compareNameVersion);
}

export function collectDuplicateLibraries(lockfile: JsonObject) {
  const packages = asObject(lockfile.packages, "package-lock packages");
  const inventory = new Map<
    string,
    Map<string, { instances: number; runtimeIncluded: boolean }>
  >();

  for (const [path, value] of Object.entries(packages)) {
    if (!path) continue;
    const record = asObject(value, `lock entry ${path}`);
    const name = packageNameFromLockPath(path);
    const version = requiredString(record.version, `${path} version`);
    const versions = inventory.get(name) ?? new Map();
    const existing = versions.get(version) ?? {
      instances: 0,
      runtimeIncluded: false,
    };
    existing.instances += 1;
    existing.runtimeIncluded ||= record.dev !== true;
    versions.set(version, existing);
    inventory.set(name, versions);
  }

  return [...inventory.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([name, versions]) => ({
      name,
      versions: [...versions.entries()]
        .map(([version, record]) => ({ version, ...record }))
        .sort((left, right) => left.version.localeCompare(right.version)),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function assertSupplyChainDependencyReview(
  manifest: JsonObject,
  lockfile: JsonObject,
  snapshot: SupplyChainReviewSnapshot,
  now = new Date(),
) {
  if (manifest.private !== true) {
    throw new Error("GreyhoundIQ must remain a private npm package.");
  }
  if (Object.prototype.hasOwnProperty.call(manifest, "publishConfig")) {
    throw new Error("Private GreyhoundIQ root must not define publishConfig.");
  }
  if (Object.prototype.hasOwnProperty.call(manifest, "workspaces")) {
    throw new Error("Private GreyhoundIQ root must not define npm workspaces.");
  }
  if (!INTERNAL_PACKAGE_PUBLISHING_JUSTIFICATION.trim()) {
    throw new Error("Internal package publishing requires an explicit justification.");
  }

  const scarfSettings = asObject(manifest.scarfSettings, "package.json scarfSettings");
  if (scarfSettings.enabled !== false) {
    throw new Error("Scarf install analytics must be explicitly disabled.");
  }
  const scripts = stringMap(manifest.scripts);
  if (scripts.postinstall !== REVIEWED_ROOT_POSTINSTALL) {
    throw new Error("Root postinstall command differs from its reviewed value.");
  }

  if (snapshot.schemaVersion !== SUPPLY_CHAIN_REVIEW_SCHEMA_VERSION) {
    throw new Error("Supply-chain review snapshot schema is unsupported.");
  }
  if (snapshot.registrySource !== APPROVED_NPM_REGISTRY) {
    throw new Error("Supply-chain review must use the approved npm registry.");
  }
  const reviewDate = parseReviewDate(snapshot.reviewDate);
  const reviewAgeDays = Math.floor((now.getTime() - reviewDate.getTime()) / 86_400_000);
  if (reviewAgeDays < -1 || reviewAgeDays > SUPPLY_CHAIN_REVIEW_MAX_AGE_DAYS) {
    throw new Error(
      `Supply-chain dependency review is ${reviewAgeDays} days old; refresh it within ${SUPPLY_CHAIN_REVIEW_MAX_AGE_DAYS} days.`,
    );
  }
  if (snapshot.lockReviewHash !== lockReviewHash(lockfile)) {
    throw new Error("Supply-chain review snapshot does not match package-lock.json.");
  }

  const expectedLifecyclePackages = REVIEWED_LIFECYCLE_SCRIPTS.map(
    ({ name, version }) => ({ name, version }),
  ).sort(compareNameVersion);
  assertCanonicalEqual(
    collectLifecycleScriptPackages(lockfile),
    expectedLifecyclePackages,
    "Lifecycle-script package inventory differs from the reviewed allowlist.",
  );
  assertCanonicalEqual(
    snapshot.lifecycleScripts,
    REVIEWED_LIFECYCLE_SCRIPTS.map(({ name, version, hooks }) => ({
      name,
      version,
      hooks: { ...hooks },
    })).sort(compareNameVersion),
    "Lifecycle hook commands differ from the reviewed allowlist.",
  );

  const directDependencies = DEPENDENCY_GROUPS.flatMap((group) =>
    Object.entries(stringMap(manifest[group])).map(([name, declaredSpecifier]) => {
      const packages = asObject(lockfile.packages, "package-lock packages");
      const record = asObject(
        packages[`node_modules/${name}`],
        `direct lock entry ${name}`,
      );
      return {
        name,
        group,
        declaredSpecifier,
        lockedVersion: requiredString(record.version, `${name} version`),
      };
    }),
  ).sort((left, right) => left.name.localeCompare(right.name));
  const reviewedDirectDependencies = [...snapshot.directDependencies].sort(
    (left, right) => left.name.localeCompare(right.name),
  );
  assertCanonicalEqual(
    reviewedDirectDependencies.map(
      ({ name, group, declaredSpecifier, lockedVersion }) => ({
        name,
        group,
        declaredSpecifier,
        lockedVersion,
      }),
    ),
    directDependencies,
    "Direct dependency review does not cover the current manifest and lockfile.",
  );

  const directNames = reviewedDirectDependencies.map(({ name }) => name);
  if (new Set(directNames).size !== directNames.length) {
    throw new Error("Direct dependency review contains duplicate package names.");
  }
  for (const dependency of reviewedDirectDependencies) {
    if (dependency.deprecated !== null) {
      throw new Error(`${dependency.name} is a deprecated direct dependency.`);
    }
    if (!Number.isSafeInteger(dependency.maintainers) || dependency.maintainers < 0) {
      throw new Error(`${dependency.name} has an invalid registry maintainer count.`);
    }
    if (dependency.maintainers < 1 && !dependency.publisher) {
      throw new Error(`${dependency.name} has no reviewed registry maintainer or publisher.`);
    }
    const registryModifiedAt = parseRegistryTimestamp(
      dependency.registryModifiedAt,
      `${dependency.name} registry metadata`,
    );
    if (!dependency.latestVersion) {
      throw new Error(`${dependency.name} has no reviewed latest version.`);
    }
    const metadataAgeDays = Math.floor(
      (reviewDate.getTime() - registryModifiedAt.getTime()) / 86_400_000,
    );
    if (
      metadataAgeDays > PACKAGE_MAINTENANCE_MAX_AGE_DAYS &&
      !Object.prototype.hasOwnProperty.call(
        APPROVED_STABLE_PACKAGE_EXCEPTIONS,
        dependency.name,
      )
    ) {
      throw new Error(
        `${dependency.name} has no registry update within ${PACKAGE_MAINTENANCE_MAX_AGE_DAYS} days and no manual maintenance review.`,
      );
    }
  }

  const classifiedRuntimeNames = Object.values(
    RUNTIME_DEPENDENCY_CLASSIFICATION,
  ).flat();
  if (new Set(classifiedRuntimeNames).size !== classifiedRuntimeNames.length) {
    throw new Error("Runtime dependency classification overlaps.");
  }
  assertCanonicalEqual(
    [...classifiedRuntimeNames].sort(),
    Object.keys(stringMap(manifest.dependencies)).sort(),
    "Runtime dependency classification does not cover every production dependency.",
  );

  const deprecatedLockEntries = collectDeprecatedLockEntries(lockfile);
  assertCanonicalEqual(
    snapshot.deprecatedLockEntries,
    deprecatedLockEntries,
    "Deprecated transitive dependency snapshot differs from package-lock.json.",
  );
  if (deprecatedLockEntries.some(({ devOnly }) => !devOnly)) {
    throw new Error("A deprecated package is included in the production dependency tree.");
  }
  assertCanonicalEqual(
    deprecatedLockEntries.map(({ name, version }) => ({ name, version })),
    REVIEWED_DEPRECATED_TRANSITIVE_PACKAGES.map(({ name, version }) => ({
      name,
      version,
    })).sort(compareNameVersion),
    "Deprecated transitive package inventory differs from its reviewed dispositions.",
  );

  const duplicateLibraries = collectDuplicateLibraries(lockfile);
  assertCanonicalEqual(
    snapshot.duplicateLibraries,
    duplicateLibraries,
    "Duplicate-library review snapshot differs from package-lock.json.",
  );

  return {
    reviewedDirectDependencies: reviewedDirectDependencies.length,
    reviewedLifecyclePackages: snapshot.lifecycleScripts.length,
    duplicateLibraryFamilies: duplicateLibraries.length,
    deprecatedDevelopmentPackages: deprecatedLockEntries.length,
  };
}

export function collectLockComponentExpectations(lockfile: JsonObject) {
  const packages = asObject(lockfile.packages, "package-lock packages");
  const expectations = new Map<string, LockComponentExpectation>();
  for (const [path, value] of Object.entries(packages)) {
    if (!path) continue;
    const record = asObject(value, `lock entry ${path}`);
    if (record.link === true) {
      throw new Error(`${path} is a local or workspace link.`);
    }
    if (typeof record.version !== "string" || !record.version) {
      throw new Error(`${path} has no immutable version.`);
    }
    if (typeof record.resolved !== "string" || !record.resolved) {
      throw new Error(`${path} has no resolved package URL.`);
    }
    if (!isApprovedRegistryUrl(record.resolved)) {
      throw new Error(`${path} resolves outside the approved npm registry.`);
    }
    const name = packageNameFromLockPath(path);
    const bomRef = `${name}@${record.version}`;
    const expectation = {
      name,
      version: record.version,
      resolved: record.resolved,
      integrityHex: parseSha512Integrity(record.integrity, path),
      purl: npmPurl(name, record.version),
    } satisfies LockComponentExpectation;
    const existing = expectations.get(bomRef);
    if (
      existing &&
      (existing.resolved !== expectation.resolved ||
        existing.integrityHex !== expectation.integrityHex)
    ) {
      throw new Error(`${bomRef} has conflicting lockfile artifacts.`);
    }
    expectations.set(bomRef, expectation);
  }
  return expectations;
}

export function assertCycloneDxSbom(
  sbom: JsonObject,
  expectedRoot: { name: string; version: string },
  expectedComponents: ReadonlyMap<string, LockComponentExpectation>,
) {
  if (sbom.bomFormat !== "CycloneDX" || sbom.specVersion !== "1.5") {
    throw new Error("npm SBOM must be CycloneDX 1.5.");
  }
  const metadata = asObject(sbom.metadata, "SBOM metadata");
  const root = asObject(metadata.component, "SBOM root component");
  const rootRef = `${expectedRoot.name}@${expectedRoot.version}`;
  if (
    typeof root.name !== "string" ||
    !root.name ||
    root.version !== expectedRoot.version ||
    root["bom-ref"] !== rootRef ||
    root.purl !== npmPurl(expectedRoot.name, expectedRoot.version)
  ) {
    throw new Error("SBOM root component does not match package.json.");
  }
  const components = asArray(sbom.components, "SBOM components");
  const dependencies = asArray(sbom.dependencies, "SBOM dependencies");
  if (components.length !== expectedComponents.size) {
    throw new Error("SBOM component count does not match unique lockfile components.");
  }

  const actualComponentRefs = new Set<string>();
  for (const value of components) {
    const component = asObject(value, "SBOM component");
    const bomRef = requiredString(component["bom-ref"], "SBOM component bom-ref");
    if (actualComponentRefs.has(bomRef)) {
      throw new Error(`SBOM component ${bomRef} is duplicated.`);
    }
    actualComponentRefs.add(bomRef);
    const expected = expectedComponents.get(bomRef);
    if (!expected) throw new Error(`SBOM component ${bomRef} is not in the lockfile.`);
    if (
      component.name !== expected.name ||
      component.version !== expected.version ||
      component.purl !== expected.purl
    ) {
      throw new Error(`SBOM component ${bomRef} identity does not match the lockfile.`);
    }
    const hashes = asArray(component.hashes, `SBOM component ${bomRef} hashes`).map(
      (hash) => asObject(hash, `SBOM component ${bomRef} hash`),
    );
    if (
      !hashes.some(
        (hash) =>
          hash.alg === "SHA-512" && hash.content === expected.integrityHex,
      )
    ) {
      throw new Error(`SBOM component ${bomRef} has no matching SHA-512 integrity.`);
    }
    const references = asArray(
      component.externalReferences,
      `SBOM component ${bomRef} external references`,
    ).map((reference) =>
      asObject(reference, `SBOM component ${bomRef} external reference`),
    );
    if (
      !references.some(
        (reference) =>
          reference.type === "distribution" &&
          reference.url === expected.resolved,
      )
    ) {
      throw new Error(`SBOM component ${bomRef} has no matching distribution URL.`);
    }
  }
  for (const bomRef of expectedComponents.keys()) {
    if (!actualComponentRefs.has(bomRef)) {
      throw new Error(`Lockfile component ${bomRef} is missing from the SBOM.`);
    }
  }

  const expectedDependencyRefs = new Set([rootRef, ...expectedComponents.keys()]);
  if (dependencies.length !== expectedDependencyRefs.size) {
    throw new Error("SBOM dependency graph does not cover every component exactly once.");
  }
  const actualDependencyRefs = new Set<string>();
  for (const value of dependencies) {
    const dependency = asObject(value, "SBOM dependency");
    const ref = requiredString(dependency.ref, "SBOM dependency ref");
    if (!expectedDependencyRefs.has(ref)) {
      throw new Error(`SBOM dependency ${ref} is not a known component.`);
    }
    if (actualDependencyRefs.has(ref)) {
      throw new Error(`SBOM dependency ${ref} is duplicated.`);
    }
    actualDependencyRefs.add(ref);
    for (const target of asArray(
      dependency.dependsOn,
      `SBOM dependency ${ref} targets`,
    )) {
      if (typeof target !== "string" || !expectedDependencyRefs.has(target)) {
        throw new Error(`SBOM dependency ${ref} has an unknown target.`);
      }
    }
  }
  for (const ref of expectedDependencyRefs) {
    if (!actualDependencyRefs.has(ref)) {
      throw new Error(`SBOM dependency graph is missing ${ref}.`);
    }
  }
  return { components: components.length, dependencyNodes: dependencies.length };
}

export function assertAuditResult(audit: JsonObject) {
  const metadata = asObject(audit.metadata, "npm audit metadata");
  const vulnerabilities = numberMap(metadata.vulnerabilities);
  for (const key of [...VULNERABILITY_KEYS, "total"] as const) {
    const count = vulnerabilities[key];
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new Error(`npm audit vulnerability count ${key} is missing or invalid.`);
    }
  }
  const computedTotal = VULNERABILITY_KEYS.reduce(
    (total, key) => total + vulnerabilities[key],
    0,
  );
  if (vulnerabilities.total !== computedTotal) {
    throw new Error("npm audit vulnerability total is inconsistent.");
  }
  const releaseBlocking = vulnerabilities.high + vulnerabilities.critical;
  if (releaseBlocking > 0) {
    throw new Error(
      `npm audit found ${releaseBlocking} high or critical vulnerabilities.`,
    );
  }
  return vulnerabilities;
}

export function assertAuditExecution(audit: JsonObject, status: number | null) {
  const vulnerabilities = assertAuditResult(audit);
  if (status !== 0) {
    throw new Error("npm audit did not complete successfully.");
  }
  return vulnerabilities;
}

export function runSupplyChainPolicy(root = process.cwd()): SupplyChainSummary {
  const manifest = readJson(resolve(root, "package.json"));
  const lockfile = readJson(resolve(root, "package-lock.json"));
  const workflow = readFileSync(resolve(root, ".github/workflows/ci.yml"), "utf8");
  const review = readFileSync(
    resolve(root, "docs/security/supply-chain-review.md"),
    "utf8",
  );
  const dependencyReview = readJson(
    resolve(root, "security/supply-chain-review.snapshot.json"),
  ) as SupplyChainReviewSnapshot;
  const workflowDirectory = resolve(root, ".github/workflows");
  const workflows = Object.fromEntries(
    readdirSync(workflowDirectory)
      .filter((file) => /\.ya?ml$/i.test(file))
      .map((file) => [
        file,
        readFileSync(resolve(workflowDirectory, file), "utf8"),
      ]),
  );

  const staticSummary = assertManifestLockPolicy(manifest, lockfile);
  assertPackageScripts(manifest);
  assertCiSupplyChainPolicy(workflow);
  const pinnedActions = assertWorkflowActionPins(workflows);
  assertSupplyChainReview(review);
  const dependencyReviewSummary = assertSupplyChainDependencyReview(
    manifest,
    lockfile,
    dependencyReview,
  );

  const expectedComponents = collectLockComponentExpectations(lockfile);

  const sbomResult = runNpmJson(root, [
    "sbom",
    "--package-lock-only",
    "--sbom-format",
    "cyclonedx",
    "--sbom-type",
    "application",
  ]);
  if (sbomResult.status !== 0) {
    throw new Error("npm sbom did not complete successfully.");
  }
  const sbomSummary = assertCycloneDxSbom(
    sbomResult.json,
    {
      name: requiredString(manifest.name, "package name"),
      version: requiredString(manifest.version, "package version"),
    },
    expectedComponents,
  );
  const auditResult = runNpmJson(
    root,
    [
      "audit",
      "--json",
      "--audit-level=high",
      `--registry=${APPROVED_NPM_REGISTRY}/`,
    ],
    true,
  );
  const vulnerabilities = assertAuditExecution(
    auditResult.json,
    auditResult.status,
  );

  return {
    ...staticSummary,
    sbomComponents: sbomSummary.components,
    sbomDependencyNodes: sbomSummary.dependencyNodes,
    pinnedActions,
    ...dependencyReviewSummary,
    vulnerabilities,
  };
}

function runNpmJson(root: string, args: string[], parseNonZero = false) {
  const npmCli = process.env.npm_execpath;
  const executable = npmCli ? process.execPath : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(executable, commandArgs, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) {
    throw new Error(`npm ${args[0]} could not be started.`);
  }
  if (result.status === null) {
    throw new Error(`npm ${args[0]} did not return an exit status.`);
  }
  if (!parseNonZero && result.status !== 0) {
    throw new Error(`npm ${args[0]} failed.`);
  }
  if (!result.stdout.trim()) {
    throw new Error(`npm ${args[0]} returned no JSON.`);
  }
  try {
    return {
      json: JSON.parse(result.stdout) as JsonObject,
      status: result.status,
    };
  } catch {
    throw new Error(`npm ${args[0]} returned invalid JSON.`);
  }
}

function extractWorkflowJob(workflow: string, jobName: string) {
  const lines = workflow.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${jobName}:`);
  if (start < 0) throw new Error(`CI workflow is missing the ${jobName} job.`);
  const end = lines.findIndex(
    (line, index) => index > start && /^  [A-Za-z0-9_-]+:\s*$/.test(line),
  );
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

function isApprovedRegistryUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.origin === APPROVED_NPM_REGISTRY &&
      url.username === "" &&
      url.password === "" &&
      url.search === "" &&
      url.hash === "" &&
      url.pathname.startsWith("/")
    );
  } catch {
    return false;
  }
}

function packageNameFromLockPath(path: string) {
  const match = path.match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)$/);
  if (!match) throw new Error(`${path} is not a canonical node_modules lock path.`);
  return match[1];
}

function parseSha512Integrity(value: unknown, path: string) {
  if (typeof value !== "string") {
    throw new Error(`${path} has no SHA-512 integrity.`);
  }
  const match = value.match(/^sha512-([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new Error(`${path} has no exact SHA-512 integrity.`);
  const digest = Buffer.from(match[1], "base64");
  if (digest.length !== 64 || digest.toString("base64") !== match[1]) {
    throw new Error(`${path} has invalid SHA-512 integrity.`);
  }
  return digest.toString("hex");
}

function npmPurl(name: string, version: string) {
  const encodedName = name.startsWith("@")
    ? `${encodeURIComponent(name.split("/")[0])}/${encodeURIComponent(name.split("/")[1] ?? "")}`
    : encodeURIComponent(name);
  return `pkg:npm/${encodedName}@${encodeURIComponent(version)}`;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function compareNameVersion(
  left: { name: string; version: string },
  right: { name: string; version: string },
) {
  return left.name.localeCompare(right.name) || left.version.localeCompare(right.version);
}

function parseReviewDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Supply-chain review date must use YYYY-MM-DD.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Supply-chain review date is invalid.");
  }
  return date;
}

function parseRegistryTimestamp(value: string, label: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} timestamp is invalid.`);
  }
  return date;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as JsonObject)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function assertCanonicalEqual(actual: unknown, expected: unknown, message: string) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    throw new Error(message);
  }
}

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as JsonObject;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function stringMap(value: unknown): Record<string, string> {
  if (value === undefined) return {};
  const object = asObject(value, "dependency map");
  return Object.fromEntries(
    Object.entries(object)
      .map(([key, item]) => {
        if (typeof item !== "string") {
          throw new Error(`Dependency ${key} must use a string specifier.`);
        }
        return [key, item] as const;
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
}

function numberMap(value: unknown): Record<string, number> {
  const object = asObject(value, "vulnerability counts");
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => {
      if (typeof item !== "number") {
        throw new Error(`Vulnerability count ${key} must be numeric.`);
      }
      return [key, item];
    }),
  );
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  try {
    const summary = runSupplyChainPolicy();
    process.stdout.write(
      `${JSON.stringify({ status: "passed", ...summary }, null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : "Supply-chain policy failed."}\n`,
    );
    process.exitCode = 1;
  }
}
