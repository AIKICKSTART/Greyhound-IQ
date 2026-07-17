import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import { discoverRouteHandlers } from "./endpoints";
import {
  SECURITY_DOCUMENT_ENDPOINT_GATE_EVIDENCE_FILE,
  SECURITY_DOCUMENT_ENDPOINT_GATE_EXPECTED_GAIN,
  SECURITY_DOCUMENT_ENDPOINT_GATE_MASTER_EVIDENCE,
  SECURITY_DOCUMENT_ENDPOINT_GATE_REQUIREMENT_IDS,
  SECURITY_DOCUMENT_ENDPOINT_GATE_SCOPE,
  SECURITY_DOCUMENT_ENDPOINT_GATE_TEST_FILE,
  evaluateSecurityDocumentEndpointGate,
  type SecurityDocumentSource,
} from "./security-document-endpoint-gate-evidence";

const repositoryRoot = path.resolve(__dirname, "..");
const requirementId = "security.ci.27.security-doc-missing-endpoint";

assert.deepEqual(SECURITY_DOCUMENT_ENDPOINT_GATE_REQUIREMENT_IDS, [
  requirementId,
]);
assert.equal(SECURITY_DOCUMENT_ENDPOINT_GATE_EXPECTED_GAIN, 1);
assert.equal(
  SECURITY_MASTER_REQUIREMENTS.find((requirement) => requirement.id === requirementId)
    ?.requirement,
  "Fail when a security tour or document references a nonexistent endpoint.",
);
assert.deepEqual(
  SECURITY_DOCUMENT_ENDPOINT_GATE_MASTER_EVIDENCE[requirementId],
  {
    status: "verified",
    evidence: [
      SECURITY_DOCUMENT_ENDPOINT_GATE_EVIDENCE_FILE,
      SECURITY_DOCUMENT_ENDPOINT_GATE_TEST_FILE,
      "security/endpoints.ts",
      "scripts/run-unit-tests.ts",
      ".github/workflows/ci.yml",
      "package.json",
    ],
  },
);
for (const evidencePath of SECURITY_DOCUMENT_ENDPOINT_GATE_MASTER_EVIDENCE[
  requirementId
].evidence) {
  assert.ok(existsSync(path.join(repositoryRoot, evidencePath)), evidencePath);
}
assert.doesNotMatch(
  readFileSync(
    path.join(repositoryRoot, SECURITY_DOCUMENT_ENDPOINT_GATE_EVIDENCE_FILE),
    "utf8",
  ),
  /(?:from\s+["']node:|require\(["']node:)/,
  "the evidence module must stay import-safe for the shared master registry",
);

const securityDocuments = walkFiles(path.join(repositoryRoot, "docs", "security"))
  .filter((file) => file.endsWith(".md"))
  .map(readDocument);
const tourSources = walkFiles(path.join(repositoryRoot, "src"))
  .filter((file) => /tour/i.test(path.basename(file)))
  .filter((file) => /\.(?:md|tsx?)$/.test(file))
  .map(readDocument);
const documents = [...securityDocuments, ...tourSources];

assert.ok(securityDocuments.length >= 20, "the complete security-doc set is required");
assert.ok(tourSources.length >= 3, "tour sources must remain inside the gate");
assert.ok(
  securityDocuments.some(
    (document) => document.path === "docs/security/security-trace-registry.md",
  ),
);

const registeredEndpoints = discoverRouteHandlers(repositoryRoot).map(
  ({ method, route }) => ({ method, route }),
);
assert.ok(registeredEndpoints.length >= 80, "the source API inventory is required");

const result = evaluateSecurityDocumentEndpointGate(
  documents,
  registeredEndpoints,
);
assert.ok(result.references.length >= 30, "the gate must not pass an empty scan");
assert.deepEqual(
  result.issues,
  [],
  result.issues
    .map(
      (issue) =>
        `${issue.sourcePath}:${issue.line} ${issue.method ?? "ANY"} ${issue.route} ${issue.reason}`,
    )
    .join("\n"),
);

const activeMissingRoute = evaluateSecurityDocumentEndpointGate(
  [{ path: "docs/security/fixture.md", content: "POST `/api/not-registered`" }],
  registeredEndpoints,
);
assert.deepEqual(activeMissingRoute.issues, [
  {
    sourcePath: "docs/security/fixture.md",
    line: 1,
    route: "/api/not-registered",
    method: "POST",
    reason: "missing-route",
  },
]);

const existingRoute = registeredEndpoints[0];
assert.ok(existingRoute);
const methodsForExistingRoute = new Set(
  registeredEndpoints
    .filter((endpoint) => endpoint.route === existingRoute.route)
    .map((endpoint) => endpoint.method),
);
const wrongMethod = (
  ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"] as const
).find((method) => !methodsForExistingRoute.has(method));
assert.ok(wrongMethod, "the negative fixture needs an unregistered HTTP method");
const activeWrongMethod = evaluateSecurityDocumentEndpointGate(
  [
    {
      path: "docs/security/wrong-method.md",
      content: `${wrongMethod} \`${existingRoute.route}\``,
    },
  ],
  registeredEndpoints,
);
assert.equal(activeWrongMethod.issues.length, 1);
assert.equal(activeWrongMethod.issues[0]?.reason, "missing-method");

const wildcardReference = evaluateSecurityDocumentEndpointGate(
  [
    {
      path: "docs/security/wildcard.md",
      content: "The internal boundary covers `/api/internal/**`.",
    },
  ],
  registeredEndpoints,
);
assert.deepEqual(wildcardReference.issues, []);

const nonCurrentReferences = evaluateSecurityDocumentEndpointGate(
  [
    {
      path: "docs/security/non-current.md",
      content: [
        "Source file `src/app/api/not-an-endpoint/route.ts`.",
        "External reference https://example.test/api/not-local.",
        "The retired `/api/removed` endpoint no longer exists.",
      ].join("\n"),
    },
  ],
  registeredEndpoints,
);
assert.deepEqual(nonCurrentReferences.references, []);
assert.deepEqual(nonCurrentReferences.issues, []);

const unitRunner = readFileSync(
  path.join(repositoryRoot, "scripts/run-unit-tests.ts"),
  "utf8",
);
const packageManifest = JSON.parse(
  readFileSync(path.join(repositoryRoot, "package.json"), "utf8"),
) as { scripts: Record<string, string> };
const ciWorkflow = readFileSync(
  path.join(repositoryRoot, ".github/workflows/ci.yml"),
  "utf8",
);
assert.match(unitRunner, /\["src", "scripts", "security"\]\.flatMap\(findTestFiles\)/);
assert.match(unitRunner, /\\\.test\\\.tsx\?\$/);
assert.match(packageManifest.scripts["test:unit"] ?? "", /run-unit-tests\.ts/);
assert.match(packageManifest.scripts.ci ?? "", /npm run test:unit/);
assert.match(ciWorkflow, /run:\s+npm run test:unit/);

assert.match(SECURITY_DOCUMENT_ENDPOINT_GATE_SCOPE, /every Markdown file below docs\/security/i);
assert.match(SECURITY_DOCUMENT_ENDPOINT_GATE_SCOPE, /every source file with tour/i);
assert.match(SECURITY_DOCUMENT_ENDPOINT_GATE_SCOPE, /missing-route and wrong-method fixtures fail closed/i);
assert.match(SECURITY_DOCUMENT_ENDPOINT_GATE_SCOPE, /does not prove deployed routing/i);

console.log(
  `Security document endpoint gate passed: ${result.references.length} active references across ${securityDocuments.length} security documents and ${tourSources.length} tour sources resolve to ${registeredEndpoints.length} registered route operations.`,
);

function walkFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const absolutePath = path.join(directory, entry);
    return statSync(absolutePath).isDirectory()
      ? walkFiles(absolutePath)
      : [absolutePath];
  });
}

function readDocument(absolutePath: string): SecurityDocumentSource {
  return {
    path: path.relative(repositoryRoot, absolutePath).replace(/\\/g, "/"),
    content: readFileSync(absolutePath, "utf8"),
  };
}
