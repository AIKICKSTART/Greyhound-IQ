import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

import {
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EXPECTED_GAIN,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_MASTER_EVIDENCE,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_REQUIREMENT_IDS,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_SCOPE,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_TEST_FILE,
} from "./product-account-support-ticket-detail-evidence";
import { PRODUCT_MASTER_REQUIREMENTS } from "./product-master-requirements";

// screen-evidence-test-id: PRODUCT-ACCOUNT-SUPPORT-TICKET-DETAIL

const REQUIREMENT_ID = "ROUTE.ACCOUNT.ticket-detail" as const;
const REQUIREMENT_TEXT = "Discover or create support-ticket details.";

assert.deepEqual(PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_REQUIREMENT_IDS, [
  REQUIREMENT_ID,
]);
assert.equal(PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EXPECTED_GAIN, 1);
assert.deepEqual(
  Object.keys(PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_MASTER_EVIDENCE),
  [REQUIREMENT_ID],
);

const requirement = PRODUCT_MASTER_REQUIREMENTS.find(
  (candidate) => candidate.id === REQUIREMENT_ID,
);
assert.ok(requirement);
assert.equal(requirement.requirement, REQUIREMENT_TEXT);

const evidence =
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_MASTER_EVIDENCE[REQUIREMENT_ID];
assert.equal(evidence.status, "tested");
assert.deepEqual(evidence.evidence.slice(0, 2), [
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EVIDENCE_FILE,
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_TEST_FILE,
]);
assert.equal(new Set(evidence.evidence).size, evidence.evidence.length);
evidence.evidence.forEach((path) => assert.equal(existsSync(path), true, path));

for (const scopeAssertion of [
  /source and unit/i,
  /current-user ownership filters/i,
  /same 404 outcome/i,
  /latest 100 messages/i,
  /does not prove reply mutation/i,
  /deployed row-level security/i,
  /route-registry integration/i,
  /onboarding coverage/i,
]) {
  assert.match(PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_SCOPE, scopeAssertion);
}

const routePath = "src/app/account/support/[id]/page.tsx";
const routeSource = source(routePath);
const pageFunction = functionSource(
  routeSource,
  "AccountSupportTicketPage",
  ts.ScriptKind.TSX,
);
for (const assertion of [
  'robots: { index: false, follow: false }',
  "requireSupportTicketProfile()",
  "getSupportTicketForCurrentUser(current, id)",
  "if (!ticket) notFound()",
  'href="/account/support"',
  "ticket.messages.length > 0",
  "No messages are available",
  "supportMessageAuthorLabel(",
  "SUPPORT_TICKET_MESSAGE_LIMIT",
]) {
  assert.ok(routeSource.includes(assertion), `${routePath}: ${assertion}`);
}
assert.match(pageFunction, /params:\s*Promise<\{ id: string \}>/);
assert.match(pageFunction, /ticket\.messages\.map\(\(message\) =>/);
assert.doesNotMatch(pageFunction, /dangerouslySetInnerHTML/);

const servicePath = "src/lib/support-ticket-service.ts";
const serviceSource = source(servicePath);
const detailFunction = functionSource(
  serviceSource,
  "getSupportTicketForCurrentUser",
);
for (const assertion of [
  "withDbRequestContext(current",
  "tx.supportTicket.findFirst",
  "id: ticketId",
  "userId: current.dbUserId",
  'orderBy: [{ createdAt: "desc" }, { id: "desc" }]',
  "take: SUPPORT_TICKET_MESSAGE_LIMIT",
  "messages: [...ticket.messages].reverse()",
]) {
  assert.ok(detailFunction.includes(assertion), `${servicePath}: ${assertion}`);
}
assert.match(
  serviceSource,
  /export const SUPPORT_TICKET_MESSAGE_LIMIT = 100;/,
);
assert.doesNotMatch(detailFunction, /withDbSystemContext/);
assert.doesNotMatch(detailFunction, /\binclude\s*:/);
assert.doesNotMatch(detailFunction, /user:\s*true|profile:\s*true/);

const listSource = source("src/app/account/support/page.tsx");
assert.match(listSource, /href=\{`\/account\/support\/\$\{ticket\.id\}`\}/);
assert.match(listSource, />\s*View ticket\s*</);

const evidenceSource = source(
  PRODUCT_ACCOUNT_SUPPORT_TICKET_DETAIL_EVIDENCE_FILE,
);
assert.doesNotMatch(evidenceSource, /from ["']node:/);
assert.doesNotMatch(evidenceSource, /\breadFileSync\b|\bprocess\.cwd\b/);

console.log(
  "Account support ticket detail evidence passed in isolation: the noindex route is owner-scoped, bounded, 404-safe and linked from support for exact +1 central wiring; replies and deployed RLS remain open.",
);

function source(path: string) {
  return readFileSync(path, "utf8");
}

function functionSource(value: string, name: string, kind = ts.ScriptKind.TS) {
  const sourceFile = ts.createSourceFile(
    "evidence.ts",
    value,
    ts.ScriptTarget.Latest,
    true,
    kind,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `Missing function ${name}`);
  return match.getText(sourceFile);
}
