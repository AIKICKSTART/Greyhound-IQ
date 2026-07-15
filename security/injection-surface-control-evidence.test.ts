import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";

import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import { logWarn } from "../src/lib/logger";
import { resolveWorkosReturnTo } from "../src/lib/workos-redirect";
import { DOWNLOAD_CONTROL_MASTER_EVIDENCE } from "./download-control-evidence";
import { EXTERNAL_LINK_EMBED_MASTER_EVIDENCE } from "./external-link-embed-evidence";
import {
  INJECTION_SURFACE_CONTROL_MASTER_EVIDENCE,
  NOT_APPLICABLE_INJECTION_SURFACE_CONTROL_IDS,
  VERIFIED_INJECTION_SURFACE_CONTROL_IDS,
} from "./injection-surface-control-evidence";
import { SSRF_CONTROL_MASTER_EVIDENCE } from "./ssrf-control-evidence";
import { XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE } from "./xss-surface-evidence";

for (const requirementId of [
  ...VERIFIED_INJECTION_SURFACE_CONTROL_IDS,
  ...NOT_APPLICABLE_INJECTION_SURFACE_CONTROL_IDS,
]) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    INJECTION_SURFACE_CONTROL_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
}

for (const underlyingRequirementId of [
  "security.xss-surface.context-escaping",
  "security.xss-surface.avoid-unsafe-html",
  "security.xss-surface.allowlist-sanitizer",
  "security.xss-surface.stored-render-test",
]) {
  assert.ok(
    XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE[
      underlyingRequirementId as keyof typeof XSS_IMPLEMENTATION_CONTROL_MASTER_EVIDENCE
    ],
    `${underlyingRequirementId}: missing XSS implementation evidence`,
  );
}
assert.ok(
  Object.prototype.hasOwnProperty.call(
    SSRF_CONTROL_MASTER_EVIDENCE,
    "security.ssrf-control.private-network",
  ),
);
assert.ok(
  Object.prototype.hasOwnProperty.call(
    SSRF_CONTROL_MASTER_EVIDENCE,
    "security.ssrf-control.dns-rebinding",
  ),
);
assert.ok(
  Object.prototype.hasOwnProperty.call(
    SSRF_CONTROL_MASTER_EVIDENCE,
    "security.ssrf-control.redirects",
  ),
);
assert.ok(
  Object.prototype.hasOwnProperty.call(
    EXTERNAL_LINK_EMBED_MASTER_EVIDENCE,
    "security.external-link-embed.scheme",
  ),
);
assert.ok(DOWNLOAD_CONTROL_MASTER_EVIDENCE["security.download-control.path"]);

for (const unsafeReturnTo of [
  "https://attacker.example/account",
  "//attacker.example/account",
  "/%2f%2fattacker.example/account",
  "/%255c%255cattacker.example/account",
  "/callback?code=attacker-controlled",
]) {
  assert.equal(resolveWorkosReturnTo({ returnTo: unsafeReturnTo }), "/feed");
}

const logLines: string[] = [];
const originalWarn = console.warn;
console.warn = (line: string) => logLines.push(line);
try {
  logWarn("attacker\nforged.event", {
    targetId: "listing-1\r\nseverity=ERROR",
    note: "first line\nsecond line",
  });
} finally {
  console.warn = originalWarn;
}
assert.equal(logLines.length, 1);
assert.doesNotMatch(logLines[0], /[\r\n]/);
assert.doesNotThrow(() => JSON.parse(logLines[0]));

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};
const directPackages = new Set([
  ...Object.keys(manifest.dependencies ?? {}),
  ...Object.keys(manifest.devDependencies ?? {}),
]);
const prohibitedSurfacePackages = [
  "@apollo/",
  "@aws-sdk/client-dynamodb",
  "@google-cloud/firestore",
  "@ldapjs/",
  "@urql/",
  "@sendgrid/",
  "apollo-server",
  "csv",
  "csv-stringify",
  "ejs",
  "eta",
  "fast-csv",
  "firebase",
  "firebase-admin",
  "graphql",
  "graphql-yoga",
  "handlebars",
  "ioredis",
  "json2csv",
  "ldapjs",
  "liquidjs",
  "mailgun.js",
  "mongodb",
  "mongoose",
  "mustache",
  "nodemailer",
  "nunjucks",
  "papaparse",
  "postmark",
  "pug",
  "redis",
  "resend",
  "urql",
] as const;
for (const packageName of directPackages) {
  assert.equal(
    prohibitedSurfacePackages.some(
      (prohibited) =>
        packageName === prohibited || packageName.startsWith(prohibited),
    ),
    false,
    `${packageName}: injection surface needs a new applicability review`,
  );
}

const productionSources = collectProductionSources("src");
const runtimeSources = productionSources.filter(
  ({ path }) =>
    !path.endsWith("security-master-requirements.ts") &&
    !path.endsWith("product-master-requirements.ts"),
);
const unsupportedImports =
  /(?:from\s+|import\s*\(|require\s*\()\s*["'](?:@apollo\/|@aws-sdk\/client-dynamodb|@google-cloud\/firestore|@ldapjs\/|@sendgrid\/|@urql\/|apollo-server|csv(?:-|\/|["'])|ejs["']|eta["']|fast-csv|firebase(?:-admin)?|graphql(?:-yoga)?|handlebars|ioredis|json2csv|ldapjs|liquidjs|mailgun\.js|mongodb|mongoose|mustache|nodemailer|nunjucks|papaparse|postmark|pug["']|redis["']|resend["']|urql["'])/;
for (const { path, source } of runtimeSources) {
  assert.doesNotMatch(
    source,
    unsupportedImports,
    `${path}: injection surface import needs an applicability review`,
  );
}

const routeSources = runtimeSources.filter(({ path }) => path.endsWith("/route.ts"));
for (const { path, source } of routeSources) {
  assert.doesNotMatch(source, /["'](?:text|application)\/csv\b/i, `${path}: CSV route`);
  assert.doesNotMatch(path, /\/graphql(?:\/|$)/i, `${path}: GraphQL route`);
}

for (const requirementId of NOT_APPLICABLE_INJECTION_SURFACE_CONTROL_IDS) {
  const evidence = INJECTION_SURFACE_CONTROL_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "not-applicable-with-justification");
  assert.ok(evidence.notApplicableJustification.length > 80);
}

console.log(
  "Injection surface controls passed: nine enforced controls and six source-scanned non-applicable surfaces.",
);

type ProductionSource = { path: string; source: string };

function collectProductionSources(directory: string): ProductionSource[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Unsupported symbolic link under production source: ${fullPath}`);
      }
      if (entry.isDirectory()) return collectProductionSources(fullPath);
      if (
        !/\.(?:c|m)?(?:j|t)sx?$/.test(entry.name) ||
        /\.(?:test|spec)\.(?:c|m)?(?:j|t)sx?$/.test(entry.name)
      ) {
        return [];
      }
      return [
        {
          path: relative(process.cwd(), fullPath).replaceAll("\\", "/"),
          source: readFileSync(fullPath, "utf8"),
        },
      ];
    })
    .toSorted((left, right) => left.path.localeCompare(right.path));
}
