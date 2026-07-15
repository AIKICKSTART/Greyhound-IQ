import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, extname, resolve } from "node:path";

const FORBIDDEN_SIGNING_EXTENSIONS = new Set([
  ".cer",
  ".crt",
  ".der",
  ".jks",
  ".key",
  ".keystore",
  ".mobileprovision",
  ".p12",
  ".p8",
  ".pem",
  ".pfx",
]);
const FORBIDDEN_SIGNING_NAMES = new Set([
  "google-services.json",
  "GoogleService-Info.plist",
]);
const FORBIDDEN_MOBILE_DEPENDENCIES = new Set([
  "@stripe/stripe-react-native",
  "eas-cli",
  "expo",
  "expo-router",
  "react-native",
  "react-native-web",
]);
const FORBIDDEN_MOBILE_DEPENDENCY_PREFIXES = [
  "@expo/",
  "@react-native/",
  "@react-navigation/",
  "expo-",
  "react-native-",
];

const root = resolve(".");
const candidateFiles = listCandidateFiles(root);
const packageJson = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
) as PackageManifest;
const findings = [
  ...findNativeSourceDirectories(candidateFiles),
  ...findSigningArtifacts(candidateFiles),
  ...findMobileDependencies(packageJson),
  ...findMobileImports(root, candidateFiles),
  ...findMobileWorkflowCommands(root, candidateFiles),
];

assert.deepEqual(
  findings,
  [],
  `Web/mobile source and deployment boundary failed:\n- ${findings.join("\n- ")}`,
);

assert.ok(findNativeSourceDirectories(["ios/AppDelegate.swift"]).length > 0);
assert.ok(findSigningArtifacts(["release/app-store-key.p8"]).length > 0);
assert.ok(
  findMobileDependencies({ dependencies: { "@prisma/client": "allowed-server", expo: "forbidden" } })
    .length > 0,
);
assert.ok(findForbiddenImportSpecifiers("import Constants from 'expo-constants';").length > 0);
assert.ok(inspectWorkflow("fixture.yml", "run: eas build --platform ios").length > 0);

console.log(
  `Design Lab web/mobile negative boundary passed (${candidateFiles.length} candidate files).`,
);

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
};

function listCandidateFiles(repositoryRoot: string) {
  const result = spawnSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr || "Unable to enumerate the Git candidate.");
  return result.stdout
    .split("\0")
    .filter(Boolean)
    .map((path) => path.replaceAll("\\", "/"))
    .sort();
}

function findNativeSourceDirectories(files: string[]) {
  return files
    .filter((path) =>
      /^(?:ios|android)(?:\/|$)|^(?:apps\/mobile|mobile)\/(?:ios|android)(?:\/|$)/i.test(
        path,
      ),
    )
    .map((path) => `web candidate contains native source directory: ${path}`);
}

function findSigningArtifacts(files: string[]) {
  return files.flatMap((path) => {
    const name = basename(path);
    const environmentFile = name.startsWith(".env") && name !== ".env.example";
    if (
      environmentFile ||
      FORBIDDEN_SIGNING_NAMES.has(name) ||
      FORBIDDEN_SIGNING_EXTENSIONS.has(extname(name).toLowerCase())
    ) {
      return [`web candidate contains signing/credential artifact: ${path}`];
    }
    return [];
  });
}

function findMobileDependencies(manifest: PackageManifest) {
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.optionalDependencies,
  };
  const findings = Object.keys(dependencies)
    .filter(
      (name) =>
        FORBIDDEN_MOBILE_DEPENDENCIES.has(name) ||
        FORBIDDEN_MOBILE_DEPENDENCY_PREFIXES.some((prefix) =>
          name.startsWith(prefix),
        ),
    )
    .map((name) => `web package declares mobile dependency: ${name}`);
  for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
    if (/(?:^|\s)(?:npx\s+)?(?:eas|expo|react-native)(?:\s|$)/i.test(command)) {
      findings.push(`web package script ${name} invokes a mobile build tool.`);
    }
  }
  return findings;
}

function findMobileImports(repositoryRoot: string, files: string[]) {
  return files.flatMap((path) => {
    if (
      !path.startsWith("src/") ||
      !/\.[cm]?[jt]sx?$/.test(path) ||
      /(?:^|\/)__tests__(?:\/|$)|\.(?:spec|test)\.[cm]?[jt]sx?$/.test(path)
    ) {
      return [];
    }
    const absolutePath = resolve(repositoryRoot, path);
    if (!existsSync(absolutePath)) return [];
    return findForbiddenImportSpecifiers(readFileSync(absolutePath, "utf8")).map(
      (specifier) => `web source imports mobile module ${specifier}: ${path}`,
    );
  });
}

function findForbiddenImportSpecifiers(source: string) {
  const findings: string[] = [];
  const importPattern =
    /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)["']([^"']+)["']/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (
      FORBIDDEN_MOBILE_DEPENDENCIES.has(specifier) ||
      FORBIDDEN_MOBILE_DEPENDENCY_PREFIXES.some((prefix) =>
        specifier.startsWith(prefix),
      ) ||
      specifier.toLowerCase().includes("greyhoundiq-mobile")
    ) {
      findings.push(specifier);
    }
  }
  return findings;
}

function findMobileWorkflowCommands(repositoryRoot: string, files: string[]) {
  return files.flatMap((path) => {
    if (!/^\.github\/workflows\/[^/]+\.ya?ml$/i.test(path)) return [];
    const absolutePath = resolve(repositoryRoot, path);
    if (!existsSync(absolutePath)) return [];
    return inspectWorkflow(path, readFileSync(absolutePath, "utf8"));
  });
}

function inspectWorkflow(path: string, workflow: string) {
  const forbidden =
    /\beas\s+(?:build|credentials|submit)\b|\bexpo\s+(?:build|upload)\b|\bfastlane\b|\bxcodebuild\b|\bgradlew\b[^\n]*(?:assemble|bundle)[^\n]*release|\b(?:apk|jar)signer\b|\bsecurity\s+import\b|expo-github-action|sign-android-release|\b(?:EAS_TOKEN|EXPO_TOKEN|ANDROID_KEYSTORE|ASC_API_KEY|APPLE_API_KEY|GOOGLE_PLAY_SERVICE_ACCOUNT)\b/i;
  return forbidden.test(workflow)
    ? [`web workflow contains mobile signing/deployment authority: ${path}`]
    : [];
}
