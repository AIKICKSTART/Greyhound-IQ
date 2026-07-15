import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import {
  OPENAPI_ENDPOINT_AUTHENTICATION,
  discoverRouteHandlers,
  discoverServerActions,
} from "../../security/endpoints";
import {
  FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS,
  FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS,
  FRONTEND_AUTHORIZATION_GUARDS,
} from "../../security/frontend-authorization-evidence";
import { SCREEN_CONTRACTS } from "./demo-experience-registry";
import {
  PRODUCT_PROTECTED_BOUNDARY_EVIDENCE_FILE,
  PRODUCT_PROTECTED_BOUNDARY_EXPECTED_GAIN,
  PRODUCT_PROTECTED_BOUNDARY_MASTER_EVIDENCE,
  PRODUCT_PROTECTED_BOUNDARY_REQUIREMENT_IDS,
  PRODUCT_PROTECTED_BOUNDARY_SCOPE,
  PRODUCT_PROTECTED_BOUNDARY_TEST_FILE,
  findProductProtectedBoundaryIssues,
  type ProductProtectedBoundaryRecord,
} from "./product-protected-boundary-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-PROTECTED-BOUNDARY

const EXPECTED_REQUIREMENTS = {
  "GLOBAL.SEC.signed-out": "Never send protected content to signed-out users.",
  "GLOBAL.SEC.safe-errors": "Return safe errors for unauthorised actions.",
} as const;

assert.deepEqual(PRODUCT_PROTECTED_BOUNDARY_REQUIREMENT_IDS, [
  "GLOBAL.SEC.signed-out",
  "GLOBAL.SEC.safe-errors",
]);
assert.equal(PRODUCT_PROTECTED_BOUNDARY_EXPECTED_GAIN, 2);
assert.deepEqual(
  Object.keys(PRODUCT_PROTECTED_BOUNDARY_MASTER_EVIDENCE),
  [...PRODUCT_PROTECTED_BOUNDARY_REQUIREMENT_IDS],
);

for (const [requirementId, requirementText] of Object.entries(
  EXPECTED_REQUIREMENTS,
)) {
  const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
    ({ id }) => id === requirementId,
  );
  assert.ok(requirement, requirementId);
  assert.equal(requirement.requirement, requirementText);

  const record =
    PRODUCT_PROTECTED_BOUNDARY_MASTER_EVIDENCE[
      requirementId as keyof typeof PRODUCT_PROTECTED_BOUNDARY_MASTER_EVIDENCE
    ];
  assert.equal(record.status, "tested", requirementId);
  assert.deepEqual(record.evidence.slice(0, 2), [
    PRODUCT_PROTECTED_BOUNDARY_EVIDENCE_FILE,
    PRODUCT_PROTECTED_BOUNDARY_TEST_FILE,
  ]);
  assert.equal(new Set(record.evidence).size, record.evidence.length);
  record.evidence.forEach((path) => assert.equal(existsSync(path), true, path));
}

const evidenceSource = source(PRODUCT_PROTECTED_BOUNDARY_EVIDENCE_FILE);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);
assert.match(PRODUCT_PROTECTED_BOUNDARY_SCOPE, /complete registered protected surface/i);
assert.match(PRODUCT_PROTECTED_BOUNDARY_SCOPE, /fixed fallback text/i);
assert.match(PRODUCT_PROTECTED_BOUNDARY_SCOPE, /not deployed identity-provider behavior/i);

const records: ProductProtectedBoundaryRecord[] = [];
const protectedScreens = SCREEN_CONTRACTS.filter(
  ({ authentication }) => authentication === "required",
);
assert.equal(protectedScreens.length, 52);
for (const screen of protectedScreens) {
  const signedOutDenials = screen.permissionRules.filter(
    ({ actor, decision }) =>
      decision === "deny" && /signed.?out|unauthenticated visitor/i.test(actor),
  );
  const focusedEvidence = screen.coverage.permissions.evidence;
  records.push({
    id: `SCREEN ${screen.route}`,
    plane: "screen",
    serverGuarded:
      (screen.coverage.permissions.status === "tested" ||
        screen.coverage.permissions.status === "verified") &&
      focusedEvidence.length > 0,
    signedOutDenied:
      signedOutDenials.length > 0 &&
      signedOutDenials.every(({ enforcedBy, testIds }) =>
        Boolean(enforcedBy.trim() && testIds.length > 0),
      ),
    safeFailure: true,
  });
}

const authenticationByOperation = new Map(
  OPENAPI_ENDPOINT_AUTHENTICATION.map((entry) => [
    `${entry.method} ${entry.route}`,
    entry.authentication,
  ]),
);
const protectedHandlers = discoverRouteHandlers().filter(
  (handler) =>
    authenticationByOperation.get(`${handler.method} ${handler.route}`) ===
    "required",
);
assert.equal(protectedHandlers.length, 71);
for (const handler of protectedHandlers) {
  const handlerSource = source(handler.sourceFile);
  const body = namedFunctionBody(
    handlerSource,
    handler.sourceFile,
    handler.handler,
  );
  const delegatedGuard =
    FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS[
      handler.sourceFile as keyof typeof FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS
    ];
  const serverGuarded =
    hasServerGuard(body) ||
    Boolean(
      delegatedGuard &&
        body.includes(`${delegatedGuard}(`) &&
        hasServerGuard(
          namedFunctionBody(handlerSource, handler.sourceFile, delegatedGuard),
        ),
    );
  const jsonErrorCalls = namedCalls(body, handler.sourceFile, "jsonError");
  records.push({
    id: `${handler.method} ${handler.route}`,
    plane: "http-handler",
    serverGuarded,
    signedOutDenied: serverGuarded,
    safeFailure:
      jsonErrorCalls.length > 0 &&
      jsonErrorCalls.every(
        (call) =>
          call.arguments.length === 1 ||
          (call.arguments.length === 2 && ts.isStringLiteral(call.arguments[1])),
      ),
  });
}

const actionExceptions = new Set(
  Object.keys(FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS),
);
const serverActions = discoverServerActions();
assert.equal(serverActions.length, 81);
assert.deepEqual(
  [...actionExceptions],
  ["src/components/site-header.tsx#signOutAction"],
);
for (const action of serverActions) {
  const body = namedFunctionBody(
    source(action.sourceFile),
    action.sourceFile,
    action.handler,
  );
  if (actionExceptions.has(action.procedure)) {
    assert.match(body, /await signOut\(\)/);
    assert.doesNotMatch(body, /FormData|Request|formData\.|request\./);
    continue;
  }
  const serverGuarded = hasServerGuard(body);
  records.push({
    id: `ACTION ${action.procedure}`,
    plane: "server-action",
    serverGuarded,
    signedOutDenied: serverGuarded,
    safeFailure: serverGuarded,
  });
}
assert.equal(records.filter(({ plane }) => plane === "server-action").length, 80);

assert.deepEqual(findProductProtectedBoundaryIssues(records), []);
assert.equal(new Set(records.map(({ id }) => id)).size, records.length);

const fixture = records[0];
assert.deepEqual(
  findProductProtectedBoundaryIssues([
    { ...fixture, serverGuarded: false, signedOutDenied: false },
  ]),
  [
    `${fixture.id}:SERVER_GUARD_MISSING`,
    `${fixture.id}:SIGNED_OUT_DENIAL_MISSING`,
  ],
);
const httpFixture = records.find(({ plane }) => plane === "http-handler");
assert.ok(httpFixture);
assert.deepEqual(
  findProductProtectedBoundaryIssues([
    { ...httpFixture, safeFailure: false },
  ]),
  [`${httpFixture.id}:SAFE_FAILURE_MISSING`],
);

const authSource = source("src/lib/auth.ts");
const currentUserGuard = namedFunctionBody(
  authSource,
  "src/lib/auth.ts",
  "requireCurrentUserProfile",
);
assertInOrder(currentUserGuard, [
  "await withAuth()",
  "if (!user)",
  'throw new Error("auth.unauthorized")',
  "await syncAuthUser(user)",
  "if (dbUser.isBanned)",
  'throw new Error("auth.forbidden")',
]);

const apiErrors = source("src/lib/api-errors.ts");
assert.match(apiErrors, /message === "auth\.unauthorized"[\s\S]*return 401/);
assert.match(apiErrors, /message === "auth\.forbidden"[\s\S]*return 403/);
assert.match(apiErrors, /status === null[\s\S]*code: "internal\.error"[\s\S]*message: fallback/);
assert.match(apiErrors, /message: status >= 500 \? fallback : message/);
assert.match(apiErrors, /response\.headers\.set\("Cache-Control", "no-store"\)/);
assert.match(apiErrors, /response\.headers\.set\(REQUEST_ID_HEADER, requestId\)/);

const pageError = source("src/app/error.tsx");
assert.doesNotMatch(pageError, /\{error\.message\}|\{error\.stack\}/);
assert.match(pageError, /REF: \{error\.digest\}/);
assert.match(pageError, /Something went wrong rendering this page/);

console.log(
  `Protected product boundary passed: ${protectedScreens.length} screens, ${protectedHandlers.length} HTTP handlers and ${records.filter(({ plane }) => plane === "server-action").length} actions deny signed-out access; protected HTTP failures use the safe shared boundary (+2 ready).`,
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function hasServerGuard(value: string) {
  return FRONTEND_AUTHORIZATION_GUARDS.some((guard) =>
    value.includes(`${guard}(`),
  );
}

function namedFunctionBody(value: string, file: string, name: string) {
  const parsed = ts.createSourceFile(
    file,
    value,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
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
  visit(parsed);
  assert.equal(matches.length, 1, `${file}#${name}: expected one function`);
  return matches[0].getText(parsed);
}

function namedCalls(value: string, file: string, name: string) {
  const parsed = ts.createSourceFile(
    file,
    value,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(parsed) === name) {
      calls.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  return calls;
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}
