import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import { ADMIN_AUTHORIZATION_INVENTORY } from "../app/admin/admin-authorization-inventory";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";
import {
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_EVIDENCE_FILE,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_EXPECTED_GAIN,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_MASTER_EVIDENCE,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_REQUIREMENT_IDS,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_TEST_FILE,
} from "./product-admin-server-authorization-evidence";
import {
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS,
  PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES,
} from "./screen-contracts/production-screen-admin-operations-interactions";

// screen-evidence-test-id: PRODUCT-ADMIN-SERVER-AUTHORIZATION

const REQUIREMENT_ID = "ROUTE.ADMIN.server-authz" as const;
const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  ({ id }) => id === REQUIREMENT_ID,
);
assert.ok(requirement);
assert.equal(
  requirement.requirement,
  "Protect every privileged mutation server-side.",
);
assert.deepEqual(PRODUCT_ADMIN_SERVER_AUTHORIZATION_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_ADMIN_SERVER_AUTHORIZATION_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_ADMIN_SERVER_AUTHORIZATION_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const evidence =
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_EVIDENCE_FILE,
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((evidencePath) =>
  assert.equal(existsSync(evidencePath), true, evidencePath),
);

assert.match(PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE, /source-static/i);
assert.match(PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE, /all 32 registered privileged server actions/i);
assert.match(PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE, /does not prove deployed identity/i);
assert.match(PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE, /request-level multi-role denial/i);
assert.match(PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE, /last-administrator concurrency/i);
assert.match(PRODUCT_ADMIN_SERVER_AUTHORIZATION_SCOPE, /all-product mutation authorization/i);

assert.equal(PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES.length, 21);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.serverActions.length, 32);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.routeHandlers.length, 1);
assert.equal(ADMIN_AUTHORIZATION_INVENTORY.runtimeDenial.status, "unverified");

const registeredActions = new Map(
  ADMIN_AUTHORIZATION_INVENTORY.serverActions.map((surface) => [
    surface.id,
    surface,
  ]),
);
const referencedSubmitters = new Set<string>();

for (const route of PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_ROUTES) {
  const interaction =
    PRODUCTION_SCREEN_ADMIN_OPERATIONS_INTERACTION_CONTRACTS[route];
  for (const form of interaction.forms) {
    if (form.submitsTo.startsWith("GET ")) continue;
    assert.match(form.submitsTo, /^SERVER ACTION /, `${route}:${form.id}`);
    for (const submitter of form.submitsTo
      .slice("SERVER ACTION ".length)
      .split(" | ")) {
      assert.ok(submitter.trim(), `${route}:${form.id}`);
      referencedSubmitters.add(submitter);
    }
  }
}
assert.equal(referencedSubmitters.size, 17);
for (const submitter of referencedSubmitters) {
  assert.equal(
    registeredActions.has(submitter),
    true,
    `${submitter}: privileged Admin form submitter is absent from the authorization inventory`,
  );
}

for (const surface of ADMIN_AUTHORIZATION_INVENTORY.serverActions) {
  const body = exportedFunctionSource(surface.sourceFile, surface.id);
  const expectedGuard =
    surface.requiredRole === "admin"
      ? "requireAdminProfile()"
      : "requireModeratorProfile()";
  const forbiddenGuard =
    surface.requiredRole === "admin"
      ? "requireModeratorProfile()"
      : "requireAdminProfile()";
  assert.ok(body.includes(expectedGuard), `${surface.id}: ${expectedGuard}`);
  assert.equal(
    body.indexOf(expectedGuard) < firstMutationOrServiceCall(body),
    true,
    `${surface.id}: guard must precede privileged work`,
  );
  assert.equal(body.includes(forbiddenGuard), false, `${surface.id}: role drift`);
}

const routeHandler = ADMIN_AUTHORIZATION_INVENTORY.routeHandlers[0];
assert.deepEqual(routeHandler, {
  kind: "route-handler",
  id: "POST /api/reports/[id]/resolve",
  sourceFile: "src/app/api/reports/[id]/resolve/route.ts",
  requiredRole: "moderator",
});
const resolveReportHandler = exportedFunctionSource(
  routeHandler.sourceFile,
  "POST",
);
assertInOrder(resolveReportHandler, [
  "requireModeratorProfile()",
  "checkRateLimit(",
  "reportResolveSchema.parse(await readBoundedJsonRequest(request))",
  "resolveReportForModerator(current, id, parsed)",
]);

const evidenceSource = readFileSync(
  PRODUCT_ADMIN_SERVER_AUTHORIZATION_EVIDENCE_FILE,
  "utf8",
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Admin server-authorization evidence passed in isolation: 21 operation screens map 17 mutation submitters into 32 guarded server actions and one guarded route handler; exact +1 central wiring is ready.",
);

function exportedFunctionSource(sourcePath: string, name: string) {
  const source = readFileSync(sourcePath, "utf8");
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    sourcePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const declaration = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ) === true,
  );
  assert.ok(declaration, `${sourcePath}: missing exported ${name}`);
  return declaration.getText(sourceFile);
}

function firstMutationOrServiceCall(body: string) {
  const sourceFile = ts.createSourceFile(
    "function.ts",
    body,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let first = Number.POSITIVE_INFINITY;

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const call = node.expression.getText(sourceFile);
      if (
        !call.startsWith("require") &&
        !call.endsWith(".parse") &&
        !call.startsWith("field") &&
        !call.startsWith("Number") &&
        !call.startsWith("String") &&
        !call.startsWith("Boolean")
      ) {
        first = Math.min(first, node.getStart(sourceFile));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return first;
}

function assertInOrder(value: string, expected: readonly string[]) {
  let cursor = -1;
  for (const token of expected) {
    const next = value.indexOf(token, cursor + 1);
    assert.ok(next > cursor, `Expected ordered token: ${token}`);
    cursor = next;
  }
}
