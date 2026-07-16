import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

import {
  MASTER_AUDIT_REQUIREMENTS,
} from "../src/components/master-audit-requirements";
import { ADMIN_AUTHORIZATION_INVENTORY } from "../src/app/admin/admin-authorization-inventory";
import { assertPaidFeatureAccess } from "../src/lib/tier-access";
import {
  OPENAPI_ENDPOINT_AUTHENTICATION,
  discoverRouteHandlers,
  discoverServerActions,
} from "./endpoints";
import {
  FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS,
  FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES,
  FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS,
  FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE,
  FRONTEND_AUTHORIZATION_GUARDS,
  FRONTEND_AUTHORIZATION_HIDDEN_FIELD_REUSABLE_COMPONENTS,
  FRONTEND_AUTHORIZATION_MASTER_EVIDENCE,
} from "./frontend-authorization-evidence";

assert.match(FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE, /Source-exhaustive/);
assert.match(FRONTEND_AUTHORIZATION_EVIDENCE_SCOPE, /separate endpoint-test/);

const requiredIds = MASTER_AUDIT_REQUIREMENTS.filter(
  ({ prompt, section }) =>
    prompt === "security" && section === "frontend-authorization",
).map(({ id }) => id);
assert.deepEqual(
  Object.keys(FRONTEND_AUTHORIZATION_MASTER_EVIDENCE).toSorted(),
  requiredIds.toSorted(),
);

const authenticationByRoute = new Map(
  OPENAPI_ENDPOINT_AUTHENTICATION.map((entry) => [
    `${entry.method} ${entry.route}`,
    entry.authentication,
  ]),
);
const protectedRoutes = discoverRouteHandlers().filter(
  (entry) =>
    authenticationByRoute.get(`${entry.method} ${entry.route}`) === "required",
);
assert.ok(protectedRoutes.length > 0);
for (const route of protectedRoutes) {
  const source = readFile(route.sourceFile);
  const body = namedFunctionBody(source, route.sourceFile, route.handler);
  const delegatedGuard =
    FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS[
      route.sourceFile as keyof typeof FRONTEND_AUTHORIZATION_DELEGATED_ROUTE_GUARDS
    ];
  assert.ok(
    hasServerGuard(body) ||
      (delegatedGuard && body.includes(`${delegatedGuard}(`)),
    `${route.method} ${route.route}: direct HTTP handler must resolve server authority`,
  );
  if (delegatedGuard) {
    assert.ok(
      hasServerGuard(namedFunctionBody(source, route.sourceFile, delegatedGuard)),
      `${route.sourceFile}#${delegatedGuard}: delegated request context must resolve server authority`,
    );
  }
}

const serverActions = discoverServerActions();
const actionExceptions = new Set(
  Object.keys(FRONTEND_AUTHORIZATION_ACTION_EXCEPTIONS),
);
for (const action of serverActions) {
  const body = namedFunctionBody(
    readFile(action.sourceFile),
    action.sourceFile,
    action.handler,
  );
  if (actionExceptions.has(action.procedure)) {
    assert.match(body, /await signOut\(\)/);
    assert.doesNotMatch(body, /FormData|Request|request\.|formData\./);
    continue;
  }
  assert.ok(
    hasServerGuard(body),
    `${action.procedure}: server action must resolve authority independently of its rendering page`,
  );
}
assert.deepEqual(
  [...actionExceptions].toSorted(),
  serverActions
    .filter((action) => actionExceptions.has(action.procedure))
    .map((action) => action.procedure)
    .toSorted(),
);

for (const surface of [
  ...ADMIN_AUTHORIZATION_INVENTORY.pages,
  ...ADMIN_AUTHORIZATION_INVENTORY.serverActions,
  ...ADMIN_AUTHORIZATION_INVENTORY.routeHandlers,
]) {
  const source = readFile(surface.sourceFile);
  const guard =
    surface.requiredRole === "admin"
      ? "requireAdminProfile"
      : "requireModeratorProfile";
  assert.match(source, new RegExp(`${guard}\\s*\\(`), `${surface.id}: ${guard}`);
}

const authSource = readFile("src/lib/auth.ts");
assert.match(authSource, /const \{ user \} = await withAuth\(\)/);
assert.match(authSource, /const dbUser = await syncAuthUser\(user\)/);
assert.match(authSource, /if \(dbUser\.isBanned\)/);
assert.match(authSource, /tier: normalizeTier\(dbUser\.subscriptionTier\)/);
assert.match(authSource, /profileRole: profile\.role/);
assert.doesNotMatch(
  authSource,
  /localStorage|sessionStorage|URLSearchParams|searchParams|FormData/,
);

const entitlementSource = readFile("src/lib/billing/entitlement-service.ts");
for (const marker of [
  "const now = new Date()",
  "userId: current.dbUserId",
  'status: "active"',
  "effectiveAt: { lte: now }",
  "expiresAt: { gt: now }",
]) {
  assert.ok(entitlementSource.includes(marker), `fresh entitlement marker: ${marker}`);
}
assert.throws(
  () => assertPaidFeatureAccess({ tier: "free" }),
  /payment\.required/,
);

const agentService = readFile("src/lib/agent-service.ts");
assert.ok(
  agentService.indexOf("assertAgentTier(current, agentType)") <
    agentService.indexOf("tx.agentRun.create"),
);
const proGate = readFile("src/components/pro-gate.tsx");
assert.match(proGate, /getCurrentUser\(\)/);
assert.match(proGate, /hasTier\(user\.tier, minTier\)/);

const alternateSources = new Map([
  ["POST /api/agents/[type]/run", readFile("src/app/api/agents/[type]/run/route.ts")],
  ["src/app/actions.ts#createAgentRun", readFile("src/app/actions.ts")],
  ["POST /api/feed", readFile("src/app/api/feed/route.ts")],
  ["src/app/actions.ts#createFeedPost", readFile("src/app/actions.ts")],
  ["/marketplace/[id]/edit", readFile("src/app/marketplace/[id]/edit/page.tsx")],
  ["/listings/[id]/edit", readFile("src/app/listings/[id]/edit/page.tsx")],
]);
for (const contract of FRONTEND_AUTHORIZATION_ALTERNATE_ROUTES) {
  for (const entrypoint of contract.entrypoints) {
    const source = alternateSources.get(entrypoint);
    assert.ok(source, `${entrypoint}: alternate route source missing`);
    assert.ok(
      source.includes(contract.service) ||
        (entrypoint === "/marketplace/[id]/edit" &&
          source.includes("../../../listings/[id]/edit/page")),
      `${entrypoint}: must retain ${contract.service} or the canonical protected implementation`,
    );
  }
  const serviceSource = [
    "src/lib/agent-service.ts",
    "src/lib/feed-service.ts",
    "src/lib/listing-service.ts",
  ]
    .map(readFile)
    .find((source) => source.includes(contract.service));
  assert.ok(serviceSource, `${contract.service}: shared service source missing`);
  assert.ok(
    serviceSource.includes(contract.serviceGuard),
    `${contract.service}: shared service guard drifted`,
  );
}

const hiddenInputs = productionTsxFiles().flatMap(hiddenInputsInFile);
assert.ok(hiddenInputs.length > 0);
for (const input of hiddenInputs) {
  assert.doesNotMatch(
    input.name,
    /^(?:role|profileRole|tier|subscriptionTier|permissions?|entitlements?|isAdmin|isModerator|isBanned|verified)$/i,
    `${input.file}: hidden fields may transport input, never authority`,
  );
  if (input.formAction && !input.formAction.startsWith("/")) {
    const source = readFile(input.file);
    const boundAction = new RegExp(
      `const\\s+${escapeRegExp(input.formAction)}\\s*=\\s*(\\w+)\\.bind\\(`,
    ).exec(source)?.[1];
    const actionStateAction = new RegExp(
      `const\\s*\\[[^\\]]*\\b${escapeRegExp(input.formAction)}\\b[^\\]]*\\]\\s*=\\s*useActionState\\(\\s*(\\w+)\\s*,`,
    ).exec(source)?.[1];
    const actionName = boundAction ?? actionStateAction ?? input.formAction;
    assert.ok(
      serverActions.some(({ handler }) => handler === actionName),
      `${input.file}: hidden-field form action ${input.formAction} must resolve to an inventoried server action`,
    );
  }
  if (!input.formAction) {
    assert.ok(
      FRONTEND_AUTHORIZATION_HIDDEN_FIELD_REUSABLE_COMPONENTS.includes(
        input.file as (typeof FRONTEND_AUTHORIZATION_HIDDEN_FIELD_REUSABLE_COMPONENTS)[number],
      ),
      `${input.file}: form-less hidden field needs an explicit reusable-component decision`,
    );
  }
}

const productionSource = productionTsFiles().map(readFile).join("\n");
assert.doesNotMatch(
  productionSource,
  /(?:localStorage|sessionStorage)[\s\S]{0,120}(?:role|tier|entitlement|permission|isAdmin|isModerator)|(?:role|tier|entitlement|permission|isAdmin|isModerator)[\s\S]{0,120}(?:localStorage|sessionStorage)/i,
);

console.log(
  `Frontend authorization passed: ${protectedRoutes.length} protected HTTP handlers, ${serverActions.length - actionExceptions.size} authority-bearing server actions, ${ADMIN_AUTHORIZATION_INVENTORY.pages.length} admin pages and ${hiddenInputs.length} hidden inputs remain server-bound`,
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

function hiddenInputsInFile(file: string) {
  const source = readFile(file);
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const inputs: Array<{ file: string; name: string; formAction: string | null }> = [];
  const visit = (node: ts.Node, forms: ts.JsxOpeningElement[] = []) => {
    const activeForms =
      ts.isJsxElement(node) && node.openingElement.tagName.getText() === "form"
        ? [...forms, node.openingElement]
        : forms;
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.tagName.getText() === "input" &&
      jsxAttributeValue(node, "type") === "hidden"
    ) {
      inputs.push({
        file,
        name: jsxAttributeValue(node, "name") ?? "",
        formAction: activeForms.length
          ? jsxAttributeValue(activeForms.at(-1)!, "action")
          : null,
      });
    }
    ts.forEachChild(node, (child) => visit(child, activeForms));
  };
  visit(sourceFile);
  return inputs;
}

function jsxAttributeValue(
  node: ts.JsxOpeningLikeElement,
  name: string,
) {
  const attribute = node.attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === name,
  );
  if (!attribute?.initializer) return null;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer.text;
  if (ts.isJsxExpression(attribute.initializer)) {
    return attribute.initializer.expression?.getText() ?? null;
  }
  return attribute.initializer.getText();
}

function productionTsxFiles() {
  return productionTsFiles().filter((file) => file.endsWith(".tsx"));
}

function productionTsFiles(directory = "src"): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name).replaceAll("\\", "/");
    if (entry.isDirectory()) return productionTsFiles(target);
    return /\.(?:ts|tsx)$/.test(entry.name) &&
      !/\.(?:test|spec)\.(?:ts|tsx)$/.test(entry.name)
      ? [target]
      : [];
  });
}

function readFile(file: string) {
  return readFileSync(file, "utf8");
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
