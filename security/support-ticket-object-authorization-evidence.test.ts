import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import ts from "typescript";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  SUPPORT_TICKET_OBJECT_AUTHORIZATION_MASTER_EVIDENCE,
  SUPPORT_TICKET_OBJECT_AUTHORIZATION_REQUIREMENT_IDS,
  SUPPORT_TICKET_OBJECT_AUTHORIZATION_SCOPE,
} from "./support-ticket-object-authorization-evidence";

const requirementId = "security.object-authorization.support-ticket-id";

assert.deepEqual(SUPPORT_TICKET_OBJECT_AUTHORIZATION_REQUIREMENT_IDS, [
  requirementId,
]);
assert.deepEqual(
  Object.keys(SUPPORT_TICKET_OBJECT_AUTHORIZATION_MASTER_EVIDENCE),
  [requirementId],
);
for (const assertion of [
  /source and unit evidence/i,
  /current database user id/i,
  /same not-found outcome/i,
  /disabled in production/i,
  /does not claim reply mutations/i,
  /deployed row-level-security parity/i,
]) {
  assert.match(SUPPORT_TICKET_OBJECT_AUTHORIZATION_SCOPE, assertion);
}

const route = functionSource(
  read("src/app/account/support/[id]/page.tsx"),
  "AccountSupportTicketPage",
  ts.ScriptKind.TSX,
);
assertInOrder(route, [
  "requireSupportTicketProfile()",
  "getSupportTicketForCurrentUser(current, id)",
  "if (!ticket) notFound()",
]);
assert.doesNotMatch(route, /withDbSystemContext|supportTicket\.(?:find|update)/);

const serviceFile = read("src/lib/support-ticket-service.ts");
const service = functionSource(
  serviceFile,
  "getSupportTicketForCurrentUser",
  ts.ScriptKind.TS,
);
assert.match(service, /withDbRequestContext\(current/);
assert.match(service, /tx\.supportTicket\.findFirst\(\{/);
assert.match(
  service,
  /where:\s*\{\s*id: ticketId,\s*userId: current\.dbUserId,?\s*\}/,
);
assert.match(service, /select:\s*\{/);
assert.match(service, /take: SUPPORT_TICKET_MESSAGE_LIMIT/);
assert.match(service, /if \(!ticket\) return null/);
assert.doesNotMatch(service, /withDbSystemContext|\binclude\s*:/);
assert.equal(
  (service.match(/tx\.supportTicket\.(?:find|create|update|delete)/g) ?? [])
    .length,
  1,
  "the detail service must have one owner-scoped support-ticket operation",
);
assert.match(
  serviceFile,
  /export const SUPPORT_TICKET_MESSAGE_LIMIT = 100;/,
);

const demoFixture = read("src/lib/demo-support-ticket.ts");
const resolveDemoFixture = functionSource(
  demoFixture,
  "resolveDemoSupportTicketFixture",
  ts.ScriptKind.TS,
);
assertInOrder(resolveDemoFixture, [
  "!isFullAccessDemo(env)",
  "current.email !== DEMO_ADMIN_EMAIL",
  "ticketId !== DEMO_SUPPORT_TICKET_ID",
  "return null",
]);
const demoFixtureTest = read("src/lib/demo-support-ticket.test.ts");
assert.match(demoFixtureTest, /email: "another@greyhoundiq\.test"/);
assert.match(demoFixtureTest, /APP_ENV: "production"/);
assert.match(demoFixtureTest, /DEMO_SUPPORT_TICKET_ID/);

const requirement = MASTER_AUDIT_REQUIREMENTS.find(
  (candidate) => candidate.id === requirementId,
);
assert.ok(requirement, `${requirementId}: immutable requirement missing`);
assert.deepEqual(
  SECURITY_MASTER_EVIDENCE[requirementId],
  SUPPORT_TICKET_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[requirementId],
);
assert.equal(isMasterRequirementComplete(requirement), true);
for (const evidencePath of SUPPORT_TICKET_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[
  requirementId
].evidence) {
  assert.equal(existsSync(evidencePath), true, evidencePath);
}

console.log(
  "Support-ticket object authorization evidence passed: server-derived owner and exact ticket id are inseparable for the member detail read",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(source: string, name: string, kind: ts.ScriptKind) {
  const sourceFile = ts.createSourceFile(
    "support-ticket-evidence.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `${name}: function missing`);
  return match.getText(sourceFile);
}

function assertInOrder(source: string, expected: readonly string[]) {
  let previous = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previous, `missing or out of order: ${value}`);
    previous = index;
  }
}

