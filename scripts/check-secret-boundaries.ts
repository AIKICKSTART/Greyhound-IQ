import { loadEnvConfig } from "@next/env";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { SECRET_INVENTORY } from "../security/secret-inventory";

const CLIENT_BUILD_ROOT = ".next/static";
const CHECK_SCRIPT = "tsx scripts/check-secret-boundaries.ts";

export type SecretBoundarySourceInputs = Readonly<{
  ciWorkflow: string;
  deployWorkflow: string;
  packageJson: string;
  exampleEnvironment: string;
}>;

export type ConfiguredSecret = Readonly<{
  identifier: string;
  value: string;
}>;

export type ClientSecretLeak = Readonly<{
  identifier: string;
  file: string;
}>;

type EnvironmentValues = Readonly<Record<string, string | undefined>>;

export function findSecretBoundarySourceIssues({
  ciWorkflow,
  deployWorkflow,
  packageJson,
  exampleEnvironment,
}: SecretBoundarySourceInputs) {
  const issues: string[] = [];
  let manifest: { scripts?: Record<string, unknown> };

  try {
    manifest = JSON.parse(packageJson) as { scripts?: Record<string, unknown> };
  } catch {
    return ["PACKAGE_JSON_INVALID"];
  }

  if (manifest.scripts?.["check:secret-boundaries"] !== CHECK_SCRIPT) {
    issues.push("SECRET_BOUNDARY_SCRIPT_MISSING");
  }
  if (!/fetch-depth:\s*0/.test(ciWorkflow)) {
    issues.push("FULL_HISTORY_CHECKOUT_MISSING");
  }
  if (
    !/ghcr\.io\/gitleaks\/gitleaks@sha256:[a-f0-9]{64}/.test(ciWorkflow) ||
    !/\bgit \. --redact --no-banner\b/.test(ciWorkflow)
  ) {
    issues.push("PINNED_HISTORY_SECRET_SCAN_MISSING");
  }

  const buildOffset = ciWorkflow.indexOf("npm run build");
  const bundleCheckOffset = ciWorkflow.indexOf(
    "npm run check:secret-boundaries -- --built",
  );
  if (buildOffset < 0 || bundleCheckOffset <= buildOffset) {
    issues.push("POST_BUILD_CLIENT_SECRET_CHECK_MISSING");
  }
  if (
    !/^\s*id-token:\s*write\s*$/m.test(deployWorkflow) ||
    !/google-github-actions\/auth@[a-f0-9]{40}/.test(deployWorkflow) ||
    !/workload_identity_provider:\s*\$\{\{\s*secrets\.GCP_WIF_PROVIDER\s*\}\}/.test(
      deployWorkflow,
    ) ||
    !/service_account:\s*\$\{\{\s*secrets\.GCP_(?:BUILD|DEPLOY)_SERVICE_ACCOUNT\s*\}\}/.test(
      deployWorkflow,
    )
  ) {
    issues.push("SHORT_LIVED_CLOUD_IDENTITY_MISSING");
  }
  if (/credentials_json:|service_account_key:|GOOGLE_APPLICATION_CREDENTIALS\s*:/.test(deployWorkflow)) {
    issues.push("LONG_LIVED_CLOUD_KEY_CONFIGURED");
  }

  issues.push(...findExampleSecretIssues(exampleEnvironment));
  return issues;
}

export function findExampleSecretIssues(exampleEnvironment: string) {
  const assignments = parseEnvironmentAssignments(exampleEnvironment);
  const identifiers = new Set(
    SECRET_INVENTORY.flatMap((record) => record.identifierNames),
  );

  return [...identifiers]
    .filter((identifier) => {
      const value = assignments.get(identifier);
      return value !== undefined && !isObviousPlaceholder(value);
    })
    .map((identifier) => `EXAMPLE_SECRET_VALUE_NOT_PLACEHOLDER:${identifier}`)
    .sort();
}

export function collectConfiguredServerSecrets(
  environment: EnvironmentValues = process.env,
): ConfiguredSecret[] {
  const values = new Map<string, string>();

  for (const record of SECRET_INVENTORY) {
    if (
      record.status === "managed-identity" ||
      record.status === "not-configured" ||
      record.status === "provider-managed-unverified"
    ) {
      continue;
    }
    for (const identifier of record.identifierNames) {
      if (identifier.startsWith("NEXT_PUBLIC_")) continue;
      const value = environment[identifier]?.trim();
      if (!value || value.length < 8 || isObviousPlaceholder(value)) continue;
      values.set(identifier, value);
    }
  }

  return [...values].map(([identifier, value]) => ({ identifier, value }));
}

export function findClientBundleSecretLeaks(
  buildRoot: string,
  secrets: readonly ConfiguredSecret[],
): ClientSecretLeak[] {
  if (!existsSync(buildRoot)) {
    throw new Error(`Client build directory does not exist: ${buildRoot}`);
  }

  const leaks: ClientSecretLeak[] = [];
  for (const file of collectRegularFiles(buildRoot)) {
    const content = readFileSync(file, "utf8");
    for (const secret of secrets) {
      if (secretVariants(secret.value).some((variant) => content.includes(variant))) {
        leaks.push({
          identifier: secret.identifier,
          file: file.replace(/\\/g, "/"),
        });
      }
    }
  }
  return leaks.sort(
    (a, b) =>
      a.identifier.localeCompare(b.identifier) || a.file.localeCompare(b.file),
  );
}

function parseEnvironmentAssignments(source: string) {
  const result = new Map<string, string>();
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    result.set(match[1], unquote(stripInlineComment(match[2]).trim()));
  }
  return result;
}

function stripInlineComment(value: string) {
  let quote: "'" | '"' | null = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "'" || character === '"') && value[index - 1] !== "\\") {
      quote = quote === character ? null : quote ?? character;
    }
    if (character === "#" && quote === null) return value.slice(0, index);
  }
  return value;
}

function unquote(value: string) {
  if (
    value.length >= 2 &&
    ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'")))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isObviousPlaceholder(value: string) {
  return (
    value === "" ||
    /(?:YOUR_|REPLACE(?:_ME)?|CHANGE(?:_ME)?|generate-|optional-|dummy|devsecret|devkey|\.example(?:[./:]|$)|localhost)/i.test(
      value,
    )
  );
}

function secretVariants(value: string) {
  return [...new Set([value, JSON.stringify(value).slice(1, -1), encodeURIComponent(value)])]
    .filter((variant) => variant.length >= 8);
}

function collectRegularFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Unsupported symbolic link in client build: ${path}`);
    }
    if (entry.isDirectory()) return collectRegularFiles(path);
    return entry.isFile() ? [path] : [];
  });
}

function isMainModule() {
  return Boolean(
    process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url,
  );
}

if (isMainModule()) {
  const repoRoot = process.cwd();
  const issues = findSecretBoundarySourceIssues({
    ciWorkflow: readFileSync(resolve(repoRoot, ".github/workflows/ci.yml"), "utf8"),
    deployWorkflow: readFileSync(
      resolve(repoRoot, ".github/workflows/cloud-run-deploy.yml"),
      "utf8",
    ),
    packageJson: readFileSync(resolve(repoRoot, "package.json"), "utf8"),
    exampleEnvironment: readFileSync(resolve(repoRoot, ".env.example"), "utf8"),
  });

  if (issues.length > 0) {
    for (const issue of issues) console.error(issue);
    process.exitCode = 1;
  } else if (process.argv.includes("--built")) {
    loadEnvConfig(repoRoot, false, { info() {}, error() {} });
    const secrets = collectConfiguredServerSecrets();
    const leaks = findClientBundleSecretLeaks(
      resolve(repoRoot, CLIENT_BUILD_ROOT),
      secrets,
    );
    if (leaks.length > 0) {
      for (const leak of leaks) {
        console.error(`${leak.identifier}: present in client bundle ${leak.file}`);
      }
      process.exitCode = 1;
    } else {
      console.log(
        `Secret boundary passed: source controls valid; ${secrets.length} configured server-secret values absent from client bundles.`,
      );
    }
  } else {
    console.log(
      "Secret boundary source controls passed; use --built after next build for client-bundle inspection.",
    );
  }
}
