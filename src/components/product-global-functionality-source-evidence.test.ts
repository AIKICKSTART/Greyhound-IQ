import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import {
  FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS,
  FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS,
  FRONTEND_AUTHORIZATION_GUARDS,
} from "../../security/frontend-authorization-evidence";
import {
  discoverRouteHandlers,
  discoverServerActions,
  OPENAPI_ENDPOINT_AUTHENTICATION,
} from "../../security/endpoints";
import { PRODUCT_MASTER_EVIDENCE } from "./master-audit-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EVIDENCE_FILE,
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EXPECTED_GAIN,
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_MASTER_EVIDENCE,
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_REQUIREMENT_IDS,
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_SCOPE,
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_TEST_FILE,
} from "./product-global-functionality-source-evidence";
import { buildProductAutomatedSourceGateRegistry } from "./product-automated-source-gate-registry";

// screen-evidence-test-id: PRODUCT-GLOBAL-FUNCTIONALITY-SOURCE-EVIDENCE

const expectedRequirements = {
  "GLOBAL.FUNC.links": "Make every link resolve to a valid destination.",
  "GLOBAL.FUNC.server-authz": "Enforce every mutation permission server-side.",
} as const;

assert.deepEqual(
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_REQUIREMENT_IDS,
  Object.keys(expectedRequirements),
);
assert.equal(PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_MASTER_EVIDENCE),
  Object.keys(expectedRequirements),
);
for (const [requirementId, requirementText] of Object.entries(
  expectedRequirements,
)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, requirementId);
  assert.equal(requirement.requirement, requirementText);

  const evidence =
    PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_MASTER_EVIDENCE[
      requirementId as keyof typeof PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_MASTER_EVIDENCE
    ];
  assert.equal(evidence.status, "tested", requirementId);
  assert.deepEqual(evidence.evidence.slice(0, 2), [
    PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EVIDENCE_FILE,
    PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_TEST_FILE,
  ]);
  assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
  evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
  assert.deepEqual(PRODUCT_MASTER_EVIDENCE[requirementId], evidence);
}

assert.match(PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_SCOPE, /source-resolvable internal/i);
assert.match(PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_SCOPE, /currently discovered protected HTTP handler/i);
assert.match(PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_SCOPE, /does not prove external-link availability/i);
assert.match(PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_SCOPE, /production readiness/i);

const evidenceSource = readFileSync(
  PRODUCT_GLOBAL_FUNCTIONALITY_SOURCE_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

const linkRegistry = buildProductAutomatedSourceGateRegistry();
assert.ok(linkRegistry.auditedSourceFiles.length >= 400);
assert.ok(linkRegistry.internalLinks.length >= 446);
assert.deepEqual(linkRegistry.internalLinkIssues, []);
for (const link of linkRegistry.internalLinks) {
  assert.ok(link.sourceLine > 0, link.id);
  assert.ok(link.ownerRoutes.length > 0, link.id);
  assert.ok(link.matchedRoutePattern, link.id);
  assert.ok(linkRegistry.routePatterns.includes(link.matchedRoutePattern), link.id);
}

const authenticationByRoute = new Map(
  OPENAPI_ENDPOINT_AUTHENTICATION.map((entry) => [
    `${entry.method} ${entry.route}`,
    entry.authentication,
  ]),
);
const protectedHandlers = discoverRouteHandlers().filter(
  (handler) =>
    authenticationByRoute.get(`${handler.method} ${handler.route}`) ===
    "required",
);
assert.ok(protectedHandlers.length > 0);
for (const handler of protectedHandlers) {
  const source = readFileSync(handler.sourceFile, "utf8");
  const body = namedFunctionBody(source, handler.sourceFile, handler.handler);
  const delegatedGuard =
    FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS[
      handler.sourceFile as keyof typeof FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS
    ];
  assert.ok(
    hasServerGuard(body) ||
      (delegatedGuard &&
        hasServerGuard(
          namedFunctionBody(source, handler.sourceFile, delegatedGuard),
        )),
    `${handler.method} ${handler.route}: missing server authority`,
  );
}

const serverActions = discoverServerActions();
const actionExceptions = new Set(
  Object.keys(FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS),
);
for (const action of serverActions) {
  const body = namedFunctionBody(
    readFileSync(action.sourceFile, "utf8"),
    action.sourceFile,
    action.handler,
  );
  if (actionExceptions.has(action.procedure)) {
    assert.match(body, /await signOut\(\)/, action.procedure);
    assert.doesNotMatch(body, /FormData|Request|request\.|formData\./, action.procedure);
    continue;
  }
  assert.ok(hasServerGuard(body), `${action.procedure}: missing server authority`);
}
assert.deepEqual(
  [...actionExceptions].toSorted(),
  serverActions
    .filter((action) => actionExceptions.has(action.procedure))
    .map((action) => action.procedure)
    .toSorted(),
);

console.log(
  `Global functionality source evidence passed: ${linkRegistry.internalLinks.length} source-resolvable internal links and ${protectedHandlers.length} protected handlers plus ${serverActions.length - actionExceptions.size} authority-bearing server actions are guarded.`,
);

function hasServerGuard(source: string) {
  return FRONTEND_AUTHORIZATION_GUARDS.some((guard) =>
    source.includes(`${guard}(`),
  );
}

function namedFunctionBody(source: string, file: string, name: string) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const matches: ts.FunctionLikeDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.name?.text === name
    ) {
      matches.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.equal(matches.length, 1, `${file}#${name}: expected one function`);
  return matches[0].getText(sourceFile);
}
