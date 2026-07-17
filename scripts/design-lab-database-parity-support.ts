import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  realpathSync,
} from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

import {
  DESIGN_LAB_APPLICATION_NAME,
  DESIGN_LAB_DATABASE_MAX_EVIDENCE_AGE_MS,
  DESIGN_LAB_DATABASE_REFERENCE_PORT,
  DESIGN_LAB_DATABASE_TARGET_PORT,
  DESIGN_LAB_RUNTIME_ROLE,
  type JsonValue,
  type QueryClient,
  type SafeDatabaseTarget,
} from "./design-lab-database-parity-contract";

/** Validates a passwordless target/reference admin URL before a collector can create a client. */
export function assertPinnedAdminDatabaseUrl(
  value: string,
  allowedPorts: readonly number[] = [
    DESIGN_LAB_DATABASE_TARGET_PORT,
    DESIGN_LAB_DATABASE_REFERENCE_PORT,
  ],
) {
  const url = parseUrl(value, "Admin database URL");
  const port = Number(url.port || "5432");
  const canonicalUrl = `postgresql://postgres@127.0.0.1:${port}/greyhoundiq`;
  if (
    value !== canonicalUrl ||
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    decodeURIComponent(url.username) !== "postgres" ||
    url.password !== "" ||
    decodeURIComponent(url.pathname.replace(/^\/+/, "")) !== "greyhoundiq" ||
    !allowedPorts.includes(port) ||
    [...url.searchParams].length !== 0 ||
    url.hash !== ""
  ) {
    throw new Error(
      "Admin database URL is outside the pinned passwordless loopback contract.",
    );
  }
  return url;
}

/** Validates the exact runtime role, endpoint, and application name before runtime proof I/O. */
export function assertPinnedRuntimeDatabaseUrl(value: string) {
  const url = parseUrl(value, "Runtime database URL");
  const parameters = [...url.searchParams];
  const canonicalUrl =
    `postgresql://${DESIGN_LAB_RUNTIME_ROLE}@127.0.0.1:${DESIGN_LAB_DATABASE_TARGET_PORT}` +
    `/greyhoundiq?application_name=${DESIGN_LAB_APPLICATION_NAME}`;
  if (
    value !== canonicalUrl ||
    url.protocol !== "postgresql:" ||
    url.hostname !== "127.0.0.1" ||
    decodeURIComponent(url.username) !== DESIGN_LAB_RUNTIME_ROLE ||
    url.password !== "" ||
    Number(url.port || "5432") !== DESIGN_LAB_DATABASE_TARGET_PORT ||
    decodeURIComponent(url.pathname.replace(/^\/+/, "")) !== "greyhoundiq" ||
    JSON.stringify(parameters) !==
      JSON.stringify([["application_name", DESIGN_LAB_APPLICATION_NAME]]) ||
    url.hash !== ""
  ) {
    throw new Error(
      "Runtime database URL is outside the pinned passwordless loopback contract.",
    );
  }
  return url;
}

/** Validates the exact loopback readiness origin before an application-binding request. */
export function assertPinnedApplicationBaseUrl(value: string) {
  const url = parseUrl(value, "Application base URL");
  if (
    value !== "http://127.0.0.1:3000" ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    Number(url.port || "80") !== 3_000 ||
    url.pathname !== "/" ||
    url.search !== "" ||
    url.username !== "" ||
    url.password !== "" ||
    url.hash !== ""
  ) {
    throw new Error(
      "Application base URL is outside the pinned credential-free loopback contract.",
    );
  }
  return url;
}

/**
 * Returns fail-closed findings unless every path is a regular tracked file whose
 * working bytes, stage-0 index entry, and current-HEAD blob are identical.
 */
export function findRepositoryCommitBindingIssues(
  repositoryRoot: string,
  repositoryPaths: readonly string[],
) {
  const issues: string[] = [];
  const root = realpathSync(repositoryRoot);
  const paths = [...new Set(repositoryPaths)].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const regularPaths: string[] = [];
  for (const repositoryPath of paths) {
    if (
      isAbsolute(repositoryPath) ||
      /[\0\r\n\t]/u.test(repositoryPath)
    ) {
      issues.push(`Unsupported repository path: ${repositoryPath}`);
      continue;
    }
    const absolutePath = resolve(root, repositoryPath);
    if (!existsSync(absolutePath)) {
      issues.push(`Repository file is missing: ${repositoryPath}`);
      continue;
    }
    const stat = lstatSync(absolutePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      issues.push(`Repository path is not a regular file: ${repositoryPath}`);
      continue;
    }
    const canonicalPath = realpathSync(absolutePath);
    const pathFromRoot = relative(root, canonicalPath);
    if (
      pathFromRoot.startsWith("..") ||
      isAbsolute(pathFromRoot)
    ) {
      issues.push(`Repository path escapes the root: ${repositoryPath}`);
      continue;
    }
    regularPaths.push(repositoryPath.replaceAll("\\", "/"));
  }

  for (let offset = 0; offset < regularPaths.length; offset += 80) {
    const chunk = regularPaths.slice(offset, offset + 80);
    const flags = git(root, ["ls-files", "-v", "-z", "--", ...chunk]);
    const stages = git(root, ["ls-files", "--stage", "-z", "--", ...chunk]);
    const heads = git(root, ["ls-tree", "-r", "-z", "HEAD", "--", ...chunk]);
    const working = spawnSync(
      "git",
      ["hash-object", "--no-filters", "--stdin-paths"],
      {
        cwd: root,
        encoding: "utf8",
        input: `${chunk.join("\n")}\n`,
      },
    );
    if (
      flags.status !== 0 ||
      stages.status !== 0 ||
      heads.status !== 0 ||
      working.status !== 0
    ) {
      issues.push("Git could not verify repository file binding.");
      continue;
    }
    const flagByPath = parseFlags(flags.stdout);
    const stageByPath = parseStages(stages.stdout);
    const headByPath = parseHeads(heads.stdout);
    const workingHashes = working.stdout.trim().split(/\r?\n/u);
    for (const [index, repositoryPath] of chunk.entries()) {
      const stage = stageByPath.get(repositoryPath);
      const head = headByPath.get(repositoryPath);
      if (
        flagByPath.get(repositoryPath) !== "H" ||
        !stage ||
        stage.stage !== "0" ||
        !/^100(?:644|755)$/u.test(stage.mode) ||
        !head ||
        head.type !== "blob" ||
        !/^100(?:644|755)$/u.test(head.mode) ||
        workingHashes[index] !== stage.sha ||
        stage.sha !== head.sha
      ) {
        issues.push(
          `Repository file is not exactly bound to stage 0 and current HEAD: ${repositoryPath}`,
        );
      }
    }
  }
  return issues;
}

/**
 * Creates the Prisma client used by parity collectors.
 * The caller must pass a URL hardened by readOnlyUrl and must always disconnect it.
 */
export async function createClient(databaseUrl: string): Promise<QueryClient> {
  const { PrismaClient } = await import("@prisma/client");
  return new PrismaClient({
    datasources: {
      db: { url: databaseUrl },
    },
  });
}

/**
 * Adds bounded, read-only PostgreSQL session controls without changing endpoint identity.
 * Invalid URLs throw; callers must validate literal-loopback scope separately.
 */
export function readOnlyUrl(value: string) {
  const url = new URL(value);
  url.searchParams.set(
    "options",
    "-c default_transaction_read_only=on -c statement_timeout=10000 -c lock_timeout=1000",
  );
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("pool_timeout", "5");
  url.searchParams.set("connect_timeout", "5");
  return url.toString();
}

/**
 * Redacts a validated PostgreSQL URL to the only credential-free target shape allowed in evidence.
 * Throws unless the host is literal 127.0.0.1 and the database is greyhoundiq.
 */
export function safeDatabaseTarget(value: string): SafeDatabaseTarget {
  const url = new URL(value);
  const protocol = url.protocol.replace(/:$/u, "");
  assert.equal(protocol, "postgresql");
  assert.equal(url.hostname, "127.0.0.1");
  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  assert.equal(database, "greyhoundiq");
  return {
    protocol: "postgresql",
    host: "127.0.0.1",
    port: Number(url.port || "5432"),
    database,
  };
}

/** Parses a persisted target object and records any deviation from the fixed safe schema. */
export function safeTargetRecord(
  value: unknown,
  label: string,
  issues: string[],
): SafeDatabaseTarget | undefined {
  const target = record(value);
  if (target) exactKeys(target, ["protocol", "host", "port", "database"], label, issues);
  if (
    !target ||
    target.protocol !== "postgresql" ||
    target.host !== "127.0.0.1" ||
    !Number.isInteger(target.port) ||
    Number(target.port) !== (label === "target" ? DESIGN_LAB_DATABASE_TARGET_PORT : DESIGN_LAB_DATABASE_REFERENCE_PORT) ||
    target.database !== "greyhoundiq"
  ) {
    issues.push(`${label} database target is unsafe.`);
    return undefined;
  }
  return target as unknown as SafeDatabaseTarget;
}

/** Reconstructs a credential-free canonical URL from a validated persisted target. */
export function targetToUrl(
  target: SafeDatabaseTarget,
  username: string,
  application = false,
) {
  const url = new URL(
    `${target.protocol}://${username}@${target.host}:${target.port}/${target.database}`,
  );
  if (application) url.searchParams.set("application_name", DESIGN_LAB_APPLICATION_NAME);
  return url.toString();
}

/** Returns the host, port, and decoded database identity used for endpoint equality checks. */
export function databaseEndpoint(url: URL) {
  return `${url.hostname}:${url.port || "5432"}/${decodeURIComponent(url.pathname)}`;
}

/** Returns the endpoint identity from a credential-free evidence target. */
export function databaseEndpointRecord(target: SafeDatabaseTarget) {
  return `${target.host}:${target.port}/${target.database}`;
}

/** Canonicalizes and deterministically sorts PostgreSQL result rows before hashing. */
export function normalizeRows(rows: unknown[]) {
  return rows.map(normalizeJson).sort((left, right) => canonical(left).localeCompare(canonical(right), "en"));
}

/** Converts PostgreSQL and JavaScript values into the verifier's stable JSON value domain. */
export function normalizeJson(value: unknown): JsonValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("hex");
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort((left, right) => left.localeCompare(right, "en"))
        .map((key) => [key, normalizeJson(value[key])]),
    );
  }
  return String(value);
}

/** Serializes an already-normalized value for deterministic comparison and hashing. */
export function canonical(value: JsonValue | object) {
  return JSON.stringify(value);
}

/** Returns a lowercase SHA-256 digest for evidence content. */
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

/** Quotes one trusted verifier-controlled string as a PostgreSQL literal. */
export function sqlLiteral(value: string) {
  return `'${value.replace(/'/gu, "''")}'`;
}

/** Narrows an unknown value to a non-array record, or returns undefined. */
export function record(value: unknown) {
  return isRecord(value) ? value : undefined;
}

/** Reports whether an unknown value is a non-null, non-array object record. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Adds an issue unless an evidence object has exactly the approved keys. */
export function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
  label: string,
  issues: string[],
) {
  const actual = Object.keys(value).sort((left, right) => left.localeCompare(right, "en"));
  const required = [...expected].sort((left, right) => left.localeCompare(right, "en"));
  if (JSON.stringify(actual) !== JSON.stringify(required)) {
    issues.push(`${label} fields are not the exact approved schema.`);
  }
}

/** Recursively detects connection strings, credentials, and sensitive evidence field names. */
export function sensitiveEvidenceIssues(value: unknown) {
  const issues: string[] = [];
  const visit = (entry: unknown, path: string) => {
    if (typeof entry === "string") {
      if (
        /postgres(?:ql)?:\/\//iu.test(entry) ||
        /\bbearer\s+\S+/iu.test(entry) ||
        /\b(?:password|secret|api[-_]?key|credential)\s*[=:]/iu.test(entry)
      ) {
        issues.push(`Sensitive connection or credential material appears at ${path}.`);
      }
      return;
    }
    if (Array.isArray(entry)) {
      entry.forEach((child, index) => visit(child, `${path}[${index}]`));
      return;
    }
    if (!isRecord(entry)) return;
    for (const [key, child] of Object.entries(entry)) {
      if (/(?:password|secret|credential|databaseUrl|adminUrl|runtimeUrl|connectionString)/iu.test(key)) {
        issues.push(`Sensitive field name appears at ${path}.${key}.`);
      }
      visit(child, `${path}.${key}`);
    }
  };
  visit(value, "$evidence");
  return issues;
}

/** Checks canonical ISO evidence time against the fixed age and clock-skew window. */
export function isFreshIsoDate(value: unknown, now: number) {
  const timestamp = canonicalIsoTimestamp(value);
  return (
    timestamp !== undefined &&
    timestamp <= now + 5 * 60_000 &&
    timestamp >= now - DESIGN_LAB_DATABASE_MAX_EVIDENCE_AGE_MS
  );
}

/** Converts an exact canonical UTC millisecond timestamp to epoch milliseconds. */
export function canonicalIsoTimestamp(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  ) return undefined;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString() !== value) {
    return undefined;
  }
  return timestamp;
}

/** Accepts null or delegates to canonicalIsoTimestamp for an exact timestamp. */
export function nullableCanonicalIsoTimestamp(value: unknown) {
  return value === null ? null : canonicalIsoTimestamp(value);
}

/** Narrows a value to a lowercase hexadecimal SHA-256 digest. */
export function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

/** Narrows a value to a lowercase 40-character Git commit identifier. */
export function isCommitSha(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value);
}

/** Matches the UUID v4 request identifiers created at GreyhoundIQ's proxy boundary. */
export function isGreyhoundIqRequestId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  );
}

/** Narrows a value to a non-negative integer used by evidence counts. */
export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Narrows a value to PostgreSQL's decimal system-identifier representation. */
export function isSystemIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^\d{10,30}$/u.test(value);
}

/** Returns a PostgreSQL text array or throws instead of coercing malformed evidence. */
export function stringArray(value: unknown) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error("PostgreSQL returned a malformed text array.");
  }
  return value as string[];
}

function parseUrl(value: string, label: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error(`${label} is outside the pinned passwordless loopback contract.`);
  }
}

function git(repositoryRoot: string, args: readonly string[]) {
  return spawnSync("git", [...args], {
    cwd: repositoryRoot,
    encoding: "utf8",
  });
}

function parseFlags(output: string) {
  const values = new Map<string, string>();
  for (const entry of output.split("\0").filter(Boolean)) {
    if (entry.length > 2 && entry[1] === " ") {
      values.set(entry.slice(2).replaceAll("\\", "/"), entry[0]);
    }
  }
  return values;
}

function parseStages(output: string) {
  const values = new Map<
    string,
    { mode: string; sha: string; stage: string }
  >();
  for (const entry of output.split("\0").filter(Boolean)) {
    const match = /^(\d{6}) ([0-9a-f]{40,64}) ([0-3])\t(.+)$/u.exec(entry);
    if (match) {
      values.set(match[4].replaceAll("\\", "/"), {
        mode: match[1],
        sha: match[2],
        stage: match[3],
      });
    }
  }
  return values;
}

function parseHeads(output: string) {
  const values = new Map<string, { mode: string; type: string; sha: string }>();
  for (const entry of output.split("\0").filter(Boolean)) {
    const match = /^(\d{6}) (\w+) ([0-9a-f]{40,64})\t(.+)$/u.exec(entry);
    if (match) {
      values.set(match[4].replaceAll("\\", "/"), {
        mode: match[1],
        type: match[2],
        sha: match[3],
      });
    }
  }
  return values;
}
