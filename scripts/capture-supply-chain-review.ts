import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { REVIEWED_LIFECYCLE_SCRIPTS } from "../security/supply-chain-dependency-review";
import {
  assertSupplyChainDependencyReview,
  collectDeprecatedLockEntries,
  collectDuplicateLibraries,
  lockReviewHash,
  type SupplyChainReviewSnapshot,
} from "./check-supply-chain-policy";

type JsonObject = Record<string, unknown>;

const APPROVED_NPM_REGISTRY = "https://registry.npmjs.org";
const DEPENDENCY_GROUPS = [
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
] as const;

const packumentCache = new Map<string, Promise<JsonObject>>();
const manifestCache = new Map<string, Promise<JsonObject>>();

export async function captureSupplyChainReview(root = process.cwd()) {
  const manifest = readJson(resolve(root, "package.json"));
  const lockfile = readJson(resolve(root, "package-lock.json"));
  const packages = asObject(lockfile.packages, "package-lock packages");

  const directDependencies = await Promise.all(
    DEPENDENCY_GROUPS.flatMap((group) =>
      Object.entries(stringMap(manifest[group])).map(
        async ([name, declaredSpecifier]) => {
          const lockRecord = asObject(
            packages[`node_modules/${name}`],
            `direct lock entry ${name}`,
          );
          const lockedVersion = requiredString(
            lockRecord.version,
            `${name} locked version`,
          );
          const [packument, lockedManifest] = await Promise.all([
            fetchPackument(name),
            fetchManifest(name, lockedVersion),
          ]);
          const distTags = asObject(packument["dist-tags"], `${name} dist-tags`);
          const latestVersion = requiredString(
            distTags.latest,
            `${name} latest version`,
          );
          const maintainers = asArray(
            lockedManifest.maintainers ?? [],
            `${name} maintainers`,
          ).length;
          const npmUser =
            lockedManifest._npmUser === undefined
              ? undefined
              : asObject(lockedManifest._npmUser, `${name} npm publisher`);

          return {
            name,
            group,
            declaredSpecifier,
            lockedVersion,
            latestVersion,
            registryModifiedAt: requiredString(
              packument.modified,
              `${name} registry modified time`,
            ),
            deprecated:
              typeof lockedManifest.deprecated === "string"
                ? lockedManifest.deprecated
                : null,
            maintainers,
            publisher:
              typeof npmUser?.name === "string" && npmUser.name
                ? npmUser.name
                : null,
            repository: repositoryUrl(lockedManifest.repository),
          };
        },
      ),
    ),
  );

  const lifecycleScripts = await Promise.all(
    REVIEWED_LIFECYCLE_SCRIPTS.map(async ({ name, version, hooks }) => {
      const packageManifest = await fetchManifest(name, version);
      const scripts = stringMap(packageManifest.scripts);
      const actualHooks = Object.fromEntries(
        Object.keys(hooks).map((hook) => [
          hook,
          requiredString(scripts[hook], `${name}@${version} ${hook}`),
        ]),
      );
      return { name, version, hooks: actualHooks };
    }),
  );

  const snapshot: SupplyChainReviewSnapshot = {
    schemaVersion: 1,
    reviewDate: reviewDateInSydney(),
    registrySource: APPROVED_NPM_REGISTRY,
    lockReviewHash: lockReviewHash(lockfile),
    directDependencies: directDependencies.sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    lifecycleScripts: lifecycleScripts.sort((left, right) =>
      left.name.localeCompare(right.name),
    ),
    duplicateLibraries: collectDuplicateLibraries(lockfile),
    deprecatedLockEntries: collectDeprecatedLockEntries(lockfile),
  };

  assertSupplyChainDependencyReview(manifest, lockfile, snapshot);
  const destination = resolve(root, "security/supply-chain-review.snapshot.json");
  writeFileSync(destination, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return snapshot;
}

async function fetchPackument(name: string) {
  const cached = packumentCache.get(name);
  if (cached) return cached;
  const request = fetchRegistryJson(registryUrl(name), {
    Accept: "application/vnd.npm.install-v1+json",
  });
  packumentCache.set(name, request);
  return request;
}

async function fetchManifest(name: string, version: string) {
  const key = `${name}@${version}`;
  const cached = manifestCache.get(key);
  if (cached) return cached;
  const request = fetchRegistryJson(
    `${registryUrl(name)}/${encodeURIComponent(version)}`,
    { Accept: "application/json" },
  );
  manifestCache.set(key, request);
  return request;
}

async function fetchRegistryJson(url: string, headers: Record<string, string>) {
  const parsed = new URL(url);
  if (parsed.origin !== APPROVED_NPM_REGISTRY) {
    throw new Error(`Refusing non-approved registry origin ${parsed.origin}.`);
  }
  const response = await fetch(parsed, { headers, redirect: "error" });
  if (!response.ok) {
    throw new Error(`Registry request failed for ${parsed.pathname}: ${response.status}.`);
  }
  return asObject(await response.json(), `registry response ${parsed.pathname}`);
}

function registryUrl(name: string) {
  return `${APPROVED_NPM_REGISTRY}/${encodeURIComponent(name)}`;
}

function repositoryUrl(value: unknown) {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const url = (value as JsonObject).url;
    return typeof url === "string" && url ? url : null;
  }
  return null;
}

function reviewDateInSydney() {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readJson(path: string) {
  return asObject(JSON.parse(readFileSync(path, "utf8")), path);
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
  return Object.fromEntries(
    Object.entries(asObject(value, "string map")).map(([key, item]) => [
      key,
      requiredString(item, key),
    ]),
  );
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function isMainModule() {
  return Boolean(
    process.argv[1] &&
      pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  captureSupplyChainReview()
    .then((snapshot) => {
      process.stdout.write(
        `${JSON.stringify({
          status: "captured",
          reviewDate: snapshot.reviewDate,
          directDependencies: snapshot.directDependencies.length,
          lifecyclePackages: snapshot.lifecycleScripts.length,
          duplicateLibraryFamilies: snapshot.duplicateLibraries.length,
          deprecatedDevelopmentPackages: snapshot.deprecatedLockEntries.length,
        })}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(
        `${error instanceof Error ? error.message : "Supply-chain review capture failed."}\n`,
      );
      process.exitCode = 1;
    });
}
