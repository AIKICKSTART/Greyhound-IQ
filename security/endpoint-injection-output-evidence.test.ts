import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { Prisma } from "@prisma/client";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { auditProductionSqlSafety } from "../scripts/check-production-sql-safety";
import {
  AUTH_CALLBACK_RECOVERY_COPY,
  parseAuthCallbackFailureReason,
  parseAuthCallbackReference,
} from "../src/lib/auth-callback-recovery";
import { feedPostWriteSchema } from "../src/lib/feed-validation";
import { setSafeHttpHeader } from "../src/lib/http-header-security";
import { assertPublicHttpUrl } from "../src/lib/link-preview";
import { logWarn } from "../src/lib/logger";
import {
  mediaSignUploadSchema,
  normalizeUploadFilename,
} from "../src/lib/media-validation";
import { assertUserExportDto } from "../src/lib/user-export-policy";
import { whitelistProviderSnapshot } from "../src/lib/live/raw-sanitizer";
import { resolveWorkosReturnTo } from "../src/lib/workos-redirect";
import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  ENDPOINT_INJECTION_OUTPUT_EVIDENCE_FILE,
  ENDPOINT_INJECTION_OUTPUT_EVIDENCE_SCOPE,
  ENDPOINT_INJECTION_OUTPUT_EXPECTED_GAIN,
  ENDPOINT_INJECTION_OUTPUT_MASTER_EVIDENCE,
  ENDPOINT_INJECTION_OUTPUT_REQUIREMENT_IDS,
  ENDPOINT_INJECTION_OUTPUT_TEST_FILE,
} from "./endpoint-injection-output-evidence";

const EXPECTED_REQUIREMENT_IDS = [
  "security.endpoint-test-injection-output.sql-injection-attempts",
  "security.endpoint-test-injection-output.stored-xss-content",
  "security.endpoint-test-injection-output.reflected-xss-content",
  "security.endpoint-test-injection-output.unsafe-markdown",
  "security.endpoint-test-injection-output.unsafe-html",
  "security.endpoint-test-injection-output.path-traversal",
  "security.endpoint-test-injection-output.header-injection",
  "security.endpoint-test-injection-output.log-injection",
  "security.endpoint-test-injection-output.unsafe-redirect-destinations",
  "security.endpoint-test-injection-output.ssrf-destinations",
  "security.endpoint-test-injection-output.spreadsheet-formula-content-in-exports",
  "security.endpoint-test-injection-output.external-api-responses-with-unexpected-values",
] as const;

assert.deepEqual(ENDPOINT_INJECTION_OUTPUT_REQUIREMENT_IDS, EXPECTED_REQUIREMENT_IDS);
assert.deepEqual(
  Object.keys(ENDPOINT_INJECTION_OUTPUT_MASTER_EVIDENCE),
  EXPECTED_REQUIREMENT_IDS,
);
assert.equal(ENDPOINT_INJECTION_OUTPUT_EXPECTED_GAIN, 12);
assert.equal(new Set(EXPECTED_REQUIREMENT_IDS).size, 12);

const immutableIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map((requirement) => requirement.id),
);
for (const requirementId of EXPECTED_REQUIREMENT_IDS) {
  assert.equal(
    immutableIds.has(requirementId),
    true,
    `${requirementId}: missing immutable requirement`,
  );
  const evidence = ENDPOINT_INJECTION_OUTPUT_MASTER_EVIDENCE[requirementId];
  assert.equal(evidence.status, "verified");
  assert.equal(evidence.evidence[0], ENDPOINT_INJECTION_OUTPUT_EVIDENCE_FILE);
  assert.equal(evidence.evidence[1], ENDPOINT_INJECTION_OUTPUT_TEST_FILE);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  for (const evidencePath of evidence.evidence) {
    assert.equal(existsSync(evidencePath), true, `${requirementId}: ${evidencePath}`);
  }
}

assert.match(ENDPOINT_INJECTION_OUTPUT_EVIDENCE_SCOPE, /Representative executable/);
assert.match(ENDPOINT_INJECTION_OUTPUT_EVIDENCE_SCOPE, /does not claim that every endpoint/);
assert.doesNotMatch(
  readFileSync(ENDPOINT_INJECTION_OUTPUT_EVIDENCE_FILE, "utf8"),
  /(?:from\s+["']node:|require\(["']node:)/,
);

// SQL injection: the hostile value remains a driver parameter, while the
// repository-wide AST policy proves production raw SQL cannot bypass that form.
const sqlPayload = "' OR 1=1; DROP TABLE User; --";
const parameterizedQuery = Prisma.sql`SELECT * FROM "User" WHERE id = ${sqlPayload}`;
assert.equal(parameterizedQuery.text, 'SELECT * FROM "User" WHERE id = $1');
assert.deepEqual(parameterizedQuery.values, [sqlPayload]);
assert.equal(parameterizedQuery.text.includes(sqlPayload), false);
const sqlAudit = auditProductionSqlSafety(process.cwd());
assert.deepEqual(sqlAudit.violations, []);
assert.ok(sqlAudit.safeRawOperationCount > 0);

// Stored XSS, HTML and Markdown: the production write schema normalizes the
// value and the production render contract is a React text child, not an HTML
// or Markdown interpreter.
const storedPayload =
  '</p><img src=x onerror="globalThis.__xss=1"><script>globalThis.__xss=2</script>';
const storedBody = feedPostWriteSchema.parse({ body: storedPayload }).body;
const storedMarkup = renderToStaticMarkup(createElement("p", null, storedBody));
assert.doesNotMatch(storedMarkup, /<(?:script|img|svg|iframe|object|embed)\b/i);
assert.equal(storedMarkup.includes("globalThis.__xss=2"), true);

const markdownPayload =
  '[open me](javascript:globalThis.__markdown_xss=1)\n<img src=x onerror="globalThis.__markdown_xss=2">';
const markdownBody = feedPostWriteSchema.parse({ body: markdownPayload }).body;
const markdownMarkup = renderToStaticMarkup(createElement("p", null, markdownBody));
assert.doesNotMatch(markdownMarkup, /<(?:a|img|script)\b/i);
assert.equal(markdownMarkup.includes("[open me](javascript:"), true);

const htmlBody = feedPostWriteSchema.parse({
  body: '<svg onload="globalThis.__html_xss=1"></svg>',
}).body;
const htmlMarkup = renderToStaticMarkup(createElement("p", null, htmlBody));
assert.doesNotMatch(htmlMarkup, /<svg\b/i);
assert.equal(htmlMarkup.includes("globalThis.__html_xss=1"), true);

// Reflected XSS: callback query values are reduced to a fixed enum or rejected
// UUID before the page renders them.
const reflectedPayload = '</code><script>globalThis.__reflected_xss=1</script>';
const reflectedReason = parseAuthCallbackFailureReason(reflectedPayload);
const reflectedReference = parseAuthCallbackReference(reflectedPayload);
assert.equal(reflectedReason, "failed");
assert.equal(reflectedReference, undefined);
const reflectedMarkup = renderToStaticMarkup(
  createElement("p", null, AUTH_CALLBACK_RECOVERY_COPY[reflectedReason].title),
);
assert.doesNotMatch(reflectedMarkup, /script|reflected_xss/i);

// Path traversal: filenames are reduced to a basename and delivery variants
// reject path syntax before storage lookup.
assert.equal(normalizeUploadFilename("../../private/race-card.jpg"), "race-card.jpg");
assert.equal(normalizeUploadFilename("..\\private\\race-card.jpg"), "race-card.jpg");
assert.equal(
  mediaSignUploadSchema.safeParse({
    filename: "race-card.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    storagePath: "../../private-object",
  }).success,
  false,
);

// Header and log injection: CRLF cannot create a second header or log line.
const headers = new Headers();
assert.equal(
  setSafeHttpHeader(headers, "content-range", "bytes 0-9/10\r\nx-injected: yes"),
  false,
);
assert.equal(headers.get("x-injected"), null);

const capturedLogs: string[] = [];
const originalWarn = console.warn;
console.warn = (line: string) => capturedLogs.push(line);
try {
  logWarn("security\nforged.event", {
    targetId: "listing-1\r\nseverity=ERROR",
    note: "first line\nsecond line",
  });
} finally {
  console.warn = originalWarn;
}
assert.equal(capturedLogs.length, 1);
assert.doesNotMatch(capturedLogs[0], /[\r\n]/);
const parsedLog = JSON.parse(capturedLogs[0]) as Record<string, unknown>;
assert.equal(parsedLog.targetId, "listing-1__severity_ERROR");

// Redirect and SSRF controls reject cross-origin, credentialed, non-HTTP and
// private-network destinations before the protected operation proceeds.
for (const destination of [
  "https://attacker.example/account",
  "//attacker.example/account",
  "/%2f%2fattacker.example/account",
  "/callback?code=attacker-controlled",
]) {
  assert.equal(resolveWorkosReturnTo({ returnTo: destination }), "/feed");
}

// Formula-like values remain data in the production JSON export, which is
// explicitly downloaded as .json rather than emitted through a CSV serializer.
const formulaPayload = '=HYPERLINK("https://attacker.example","open")';
const exportPayload = { schemaVersion: "test", profile: { displayName: formulaPayload } };
assert.doesNotThrow(() => assertUserExportDto(exportPayload));
const serializedExport = JSON.stringify(exportPayload);
assert.equal(JSON.parse(serializedExport).profile.displayName, formulaPayload);
const exportRoute = readFileSync("src/app/api/users/me/export/route.ts", "utf8");
assert.match(exportRoute, /JSON\.stringify\(archive, null, 2\)/);
assert.match(exportRoute, /application\/json; charset=utf-8/);
assert.match(exportRoute, /greyhoundiq-export-\$\{date\}\.json/);
assert.doesNotMatch(exportRoute, /(?:text|application)\/csv/i);

// Unexpected provider fields are allowlisted away; an unknown provider does
// not become an accepted snapshot.
assert.equal(
  whitelistProviderSnapshot(
    JSON.stringify({
      id: 7,
      dogName: "Fast Hound",
      resultTime: 29.8,
      futureProviderField: "must not persist",
      __proto__: { polluted: true },
    }),
    "watchdog",
    "runner",
  ),
  JSON.stringify({ id: 7, dogName: "Fast Hound", resultTime: 29.8 }),
);
assert.equal(
  whitelistProviderSnapshot(JSON.stringify({ id: 7 }), "unexpected", "runner"),
  null,
);

void assertSsrfDestinations().then(
  () => {
    console.log(
      "Endpoint injection/output evidence passed: 12 representative attack classes handled safely by executable production boundaries",
    );
  },
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);

async function assertSsrfDestinations() {
  const publicResolver = async () => [{ address: "8.8.8.8", family: 4 }];
  for (const destination of [
    "file:///etc/passwd",
    "ftp://public.example/file",
    "https://user:password@public.example/private",
  ]) {
    await assert.rejects(() => assertPublicHttpUrl(destination, publicResolver));
  }
  await assert.rejects(
    () =>
      assertPublicHttpUrl(
        "http://metadata.google.internal/computeMetadata/v1",
        async () => [{ address: "169.254.169.254", family: 4 }],
      ),
    /link_preview\.private_address/,
  );
}
