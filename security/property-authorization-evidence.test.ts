import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import ts from "typescript";
import { z } from "zod";

import { SECURITY_MASTER_REQUIREMENTS } from "../src/components/security-master-requirements";
import {
  discoverRouteHandlers,
  discoverServerActions,
  ENDPOINTS,
} from "./endpoints";
import {
  buildPropertyAuthorizationMasterEvidence,
  evaluatePropertyAuthorizationFacts,
  PROPERTY_AUTHORIZATION_FACTS,
  PROPERTY_AUTHORIZATION_MASTER_EVIDENCE,
  PROPERTY_AUTHORIZATION_REQUIREMENT_IDS,
  PROPERTY_AUTHORIZATION_RESIDUAL_RISKS,
  PROTECTED_MUTATION_FIELDS,
  VERIFIED_PROPERTY_AUTHORIZATION_IDS,
  type PropertyAuthorizationFact,
} from "./property-authorization-evidence";

const MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PROTECTED_FIELDS = new Set<string>(PROTECTED_MUTATION_FIELDS);

type ObjectBodyBoundary = {
  key: string;
  schema: string;
};

const OBJECT_BODY_BOUNDARIES: readonly ObjectBodyBoundary[] = [
  body("POST", "src/app/api/actors/[actorId]/mute/route.ts", "muteSchema"),
  body("POST", "src/app/api/agents/[type]/run/route.ts", "agentRunSchema"),
  body("POST", "src/app/api/billing/boost/checkout/route.ts", "boostCheckoutRequestSchema"),
  body("POST", "src/app/api/billing/checkout/route.ts", "checkoutRequestSchema"),
  body("POST", "src/app/api/calls/[roomId]/invite/route.ts", "callInviteActionSchema"),
  body("POST", "src/app/api/calls/rooms/route.ts", "callRoomCreateSchema"),
  body("POST", "src/app/api/conversations/[id]/messages/route.ts", "conversationMessageSchema"),
  body("POST", "src/app/api/conversations/route.ts", "conversationStartSchema"),
  body("POST", "src/app/api/dogs/[id]/claim/route.ts", "dogOwnershipClaimSchema"),
  body("POST", "src/app/api/feed/[postId]/comments/route.ts", "feedCommentWriteSchema"),
  body("POST", "src/app/api/feed/[postId]/reaction/route.ts", "feedReactionWriteSchema"),
  body("PATCH", "src/app/api/feed/[postId]/route.ts", "feedPostEditSchema"),
  body("POST", "src/app/api/feed/[postId]/save/route.ts", "actorSchema"),
  body("POST", "src/app/api/feed/[postId]/share/route.ts", "feedShareWriteSchema"),
  body("POST", "src/app/api/feed/comments/[commentId]/reaction/route.ts", "feedReactionWriteSchema"),
  body("PATCH", "src/app/api/feed/comments/[commentId]/route.ts", "editCommentSchema"),
  body("POST", "src/app/api/feed/racing-day/route.ts", "feedRacingDaySchema"),
  body("POST", "src/app/api/feed/route.ts", "feedPostWriteSchema"),
  body("POST", "src/app/api/feed/topics/[topicId]/follow/route.ts", "followSchema"),
  body("POST", "src/app/api/forum/categories/[slug]/threads/route.ts", "createThreadSchema"),
  body("POST", "src/app/api/forum/threads/[id]/posts/route.ts", "createPostSchema"),
  body("POST", "src/app/api/listings/[id]/enquiry/route.ts", "listingEnquirySchema"),
  body("PATCH", "src/app/api/listings/[id]/route.ts", "listingPatchSchema"),
  body("POST", "src/app/api/listings/route.ts", "listingWriteSchema"),
  body("POST", "src/app/api/media/[id]/finalize/route.ts", "mediaFinalizeSchema"),
  body("PATCH", "src/app/api/media/[id]/route.ts", "mediaMetadataUpdateSchema"),
  body("POST", "src/app/api/media/sign-upload/route.ts", "mediaSignUploadSchema"),
  body("POST", "src/app/api/memory/[id]/supersede/route.ts", "memorySupersedeSchema"),
  body("POST", "src/app/api/memory/route.ts", "memoryCreateSchema"),
  body("POST", "src/app/api/messages/route.ts", "sendMessageSchema"),
  body("POST", "src/app/api/reports/[id]/resolve/route.ts", "reportResolveSchema"),
  body("POST", "src/app/api/reports/route.ts", "reportCreateSchema"),
  body("POST", "src/app/api/users/me/delete/route.ts", "deletionRequestSchema"),
  body("POST", "src/app/api/users/me/marketing-preferences/route.ts", "marketingPreferenceSchema"),
  body("PATCH", "src/app/api/users/me/profile/route.ts", "profileUpdateSchema"),
] as const;

const SIGNED_PROVIDER_BODY_BOUNDARIES = new Map([
  [
    mutationKey("POST", "src/app/api/livekit/webhook/route.ts"),
    [
      /readBoundedWebhookText\(request\)/,
      /receiveLiveKitWebhook\(body, auth\)/,
    ],
  ],
  [
    mutationKey("POST", "src/app/api/webhooks/lago/route.ts"),
    [
      /readBoundedWebhookBody\(request\)/,
      /ingestLagoWebhook\(/,
    ],
  ],
  [
    mutationKey("POST", "src/app/api/webhooks/stripe/route.ts"),
    [
      /readBoundedWebhookBody\(request\)/,
      /ingestStripeWebhook\(/,
    ],
  ],
]);

const BINARY_BODY_BOUNDARIES = new Map([
  [
    mutationKey("PUT", "src/app/api/media/[id]/caption/route.ts"),
    [/readWebVttUpload\(request\)/, /replaceMediaCaptionForCurrentUser\(/],
  ],
]);

const ALLOWED_CONTEXTUAL_SCHEMA_FIELDS = new Map<string, readonly string[]>([
  ["checkoutRequestSchema", ["plan"]],
  ["dogOwnershipClaimSchema", ["role"]],
]);

const immutableRequirementIds = new Set(
  SECURITY_MASTER_REQUIREMENTS.map(({ id }) => id),
);
assert.equal(PROTECTED_MUTATION_FIELDS.length, 22);
assert.equal(PROPERTY_AUTHORIZATION_REQUIREMENT_IDS.length, 31);
assert.deepEqual(
  VERIFIED_PROPERTY_AUTHORIZATION_IDS,
  PROPERTY_AUTHORIZATION_REQUIREMENT_IDS,
);
for (const requirementId of PROPERTY_AUTHORIZATION_REQUIREMENT_IDS) {
  assert.ok(
    immutableRequirementIds.has(requirementId),
    `${requirementId}: missing immutable requirement`,
  );
}

const discoveredRoutes = discoverRouteHandlers().filter(({ method }) =>
  MUTATION_METHODS.has(method),
);
const discoveredActions = discoverServerActions();
const discoveredKeys = [
  ...discoveredRoutes.map(({ method, sourceFile }) =>
    mutationKey(method, sourceFile),
  ),
  ...discoveredActions.map(({ procedure }) => `ACTION ${procedure}`),
].toSorted();
const registryKeys = ENDPOINTS.filter(
  ({ protocol, method }) =>
    protocol === "server-action" ||
    (protocol === "http" && MUTATION_METHODS.has(method)),
)
  .map(({ protocol, method, sourceFile, handler }) =>
    protocol === "server-action"
      ? `ACTION ${sourceFile}#${handler}`
      : mutationKey(method, sourceFile),
  )
  .toSorted();
assert.deepEqual(
  registryKeys,
  discoveredKeys,
  "the property-authorization audit must cover every discovered mutation boundary",
);
assert.ok(
  discoveredKeys.length >= 145,
  "the source-derived mutation inventory unexpectedly lost audited boundaries",
);

const configPath = ts.findConfigFile(process.cwd(), ts.sys.fileExists, "tsconfig.json");
assert.ok(configPath, "tsconfig.json is required for schema symbol resolution");
const configResult = ts.readConfigFile(configPath, ts.sys.readFile);
assert.equal(configResult.error, undefined);
const parsedConfig = ts.parseJsonConfigFileContent(
  configResult.config,
  ts.sys,
  process.cwd(),
);
const program = ts.createProgram(parsedConfig.fileNames, parsedConfig.options);
const checker = program.getTypeChecker();

const objectBoundaryKeys = new Set(
  OBJECT_BODY_BOUNDARIES.map(({ key }) => key),
);
assert.equal(objectBoundaryKeys.size, OBJECT_BODY_BOUNDARIES.length);

for (const { key, schema } of OBJECT_BODY_BOUNDARIES) {
  const sourcePath = key.slice(key.indexOf(" ") + 1);
  const source = read(sourcePath);
  assert.match(
    source,
    new RegExp(`\\b${escapeRegExp(schema)}\\.parse\\s*\\(`),
    `${key}: the declared object body schema must parse the boundary input`,
  );

  const sourceFile = sourceFileFor(sourcePath);
  const schemaNode = findIdentifier(sourceFile, schema);
  assert.ok(schemaNode, `${key}: could not resolve ${schema}`);
  const schemaShape = collectSchemaShape(schemaNode, checker);
  assert.equal(
    schemaShape.objectSchemaFound,
    true,
    `${key}: ${schema} must resolve to a Zod object allowlist`,
  );
  assert.ok(
    schemaShape.fields.size > 0,
    `${key}: ${schema} must expose at least one allowlisted property`,
  );

  const protectedFields = [...schemaShape.fields]
    .filter((field) => PROTECTED_FIELDS.has(field))
    .toSorted();
  const expected = [
    ...(ALLOWED_CONTEXTUAL_SCHEMA_FIELDS.get(schema) ?? []),
  ].toSorted();
  assert.deepEqual(
    protectedFields,
    expected,
    `${key}: protected schema fields require an explicit contextual policy`,
  );

  const handler = findFunction(sourceFile, key.split(" ", 1)[0]);
  assert.ok(handler, `${key}: exported mutation handler was not found`);
  assert.deepEqual(
    massAssignmentIssues(handler, sourceFile),
    [],
    `${key}: raw input must never reach a write sink`,
  );
}

const specialBodyKeys = new Set([
  ...SIGNED_PROVIDER_BODY_BOUNDARIES.keys(),
  ...BINARY_BODY_BOUNDARIES.keys(),
]);
const bodyReaderPattern =
  /request\.(?:json|text|formData|arrayBuffer|blob)\s*\(|readBounded(?:Json|OptionalJson|JsonOrForm)Request\(request\)|readBoundedWebhook(?:Body|Text)\(request\)|readWebVttUpload\(request\)/;
for (const { method, sourceFile } of discoveredRoutes) {
  const key = mutationKey(method, sourceFile);
  const sourceNode = sourceFileFor(sourceFile);
  const handler = findFunction(sourceNode, method);
  assert.ok(handler, `${key}: handler was not found`);
  const handlerSource = handler.getText(sourceNode);
  const hasBodyReader = bodyReaderPattern.test(handlerSource);
  const classified = objectBoundaryKeys.has(key) || specialBodyKeys.has(key);
  assert.equal(
    hasBodyReader,
    classified,
    `${key}: every mutation body must have exactly one reviewed input policy`,
  );
}

for (const [key, patterns] of SIGNED_PROVIDER_BODY_BOUNDARIES) {
  const sourcePath = key.slice(key.indexOf(" ") + 1);
  const source = read(sourcePath);
  for (const pattern of patterns) {
    assert.match(source, pattern, `${key}: signed provider control missing`);
  }
}
assert.match(
  read("src/lib/billing/lago-webhooks.ts"),
  /ingestLagoWebhook[\s\S]*verifyLagoWebhook\(headers, rawBody\)/,
);
assert.match(
  read("src/lib/billing/stripe-webhooks.ts"),
  /ingestStripeWebhook[\s\S]*verifyStripeWebhook\(headers, rawBody\)[\s\S]*webhooks\.constructEvent\(/,
);
for (const [key, patterns] of BINARY_BODY_BOUNDARIES) {
  const sourcePath = key.slice(key.indexOf(" ") + 1);
  const source = read(sourcePath);
  for (const pattern of patterns) {
    assert.match(source, pattern, `${key}: binary body control missing`);
  }
}

const checkoutSource = read("src/app/api/billing/checkout/route.ts");
const checkoutValidationSource = read(
  "src/lib/billing/checkout-validation.ts",
);
const stripeServiceSource = read("src/lib/billing/stripe-service.ts");
assert.match(checkoutSource, /const checkoutRequestSchema = billingCheckoutRequestSchema/);
assert.match(checkoutValidationSource, /plan: z\.literal\("pro"\)/);
assert.match(
  stripeServiceSource,
  /line_items: \[\{ price: env\.prices\[plan\]\[interval\], quantity: 1 \}\]/,
  "checkout plan selection must resolve to a server-owned Stripe price",
);

const ownershipSources = [
  read("src/app/actions.ts"),
  read("src/app/api/dogs/[id]/claim/route.ts"),
];
for (const source of ownershipSources) {
  assert.match(source, /status: "pending"/);
  assert.match(source, /verified: false/);
  assert.match(source, /profileId: current\.profileId/);
}

const actionProtectedFields = new Map<string, string[]>();
const protectedScalarParameters = new Set<string>();
for (const { sourceFile, handler, procedure } of discoveredActions) {
  const sourceNode = sourceFileFor(sourceFile);
  const action = findFunction(sourceNode, handler);
  assert.ok(action, `${procedure}: Server Action function was not found`);

  for (const parameter of action.parameters) {
    assert.ok(
      ts.isIdentifier(parameter.name),
      `${procedure}: object binding parameters require an explicit review`,
    );
    const type = parameter.type?.getText(sourceNode) ?? "";
    if (PROTECTED_FIELDS.has(parameter.name.text) && type !== "FormData") {
      protectedScalarParameters.add(`${procedure}:${parameter.name.text}`);
    }
    if (!/^(?:FormData|string|boolean)?$/.test(type)) {
      const parameterName = parameter.name.text;
      let usedInBody = false;
      if (action.body) {
        walk(action.body, (node) => {
          if (ts.isIdentifier(node) && node.text === parameterName) {
            usedInBody = true;
          }
        });
      }
      assert.ok(
        parameterName.startsWith("_") && !usedInBody,
        `${procedure}: object-valued input is allowed only as unused framework state`,
      );
    }
  }

  assert.deepEqual(
    massAssignmentIssues(action, sourceNode),
    [],
    `${procedure}: FormData must not be forwarded or spread`,
  );

  const actionSource = action.getText(sourceNode);
  assert.doesNotMatch(actionSource, /Object\.fromEntries\s*\(\s*_?formData\s*\)/);
  assert.doesNotMatch(actionSource, /_?formData\.(?:entries|forEach|keys|values)\s*\(/);

  const accepted = collectFormDataFields(action, sourceNode);
  const protectedAccepted = [...accepted].filter((field) =>
    PROTECTED_FIELDS.has(field),
  );
  if (protectedAccepted.length > 0) {
    actionProtectedFields.set(procedure, protectedAccepted.toSorted());
  }

  if (sourceFile.startsWith("src/app/admin/")) {
    const guardIndex = actionSource.search(
      /require(?:Admin|Moderator)Profile\s*\(/,
    );
    const firstInputIndex = actionSource.search(
      /(?:field|optionalField|checkbox|raw)\s*\(\s*formData|formData\.(?:get|getAll|has)/,
    );
    assert.ok(guardIndex >= 0, `${procedure}: privileged action requires a guard`);
    assert.ok(
      firstInputIndex < 0 || guardIndex < firstInputIndex,
      `${procedure}: the privilege guard must execute before input processing`,
    );
  }
}
assert.deepEqual(
  [...protectedScalarParameters],
  [],
  "protected authority properties must not enter Server Actions as scalar parameters",
);

assert.deepEqual(
  Object.fromEntries([...actionProtectedFields].sort()),
  {
    "src/app/actions.ts#claimDogOwnership": ["role"],
    "src/app/account/team/actions.ts#changeTeamMemberRoleAction": ["role"],
    "src/app/account/team/actions.ts#createTeamInvitationAction": ["role"],
    "src/app/admin/mutations.ts#createAdminInvitationAction": ["role"],
    "src/app/admin/mutations.ts#createAdminUserAction": ["role"],
    "src/app/admin/mutations.ts#updateAdminStatus": ["id"],
    "src/app/admin/mutations.ts#updateAdminUserAccessAction": ["role", "userId"],
    "src/app/admin/mutations.ts#updateBespokeRequestAction": ["id"],
    "src/app/admin/mutations.ts#upsertAdminOrganizationAction": ["ownerId"],
  },
  "protected FormData fields must stay limited to reviewed contextual or privileged actions",
);

const protectedFormFieldsAcrossActionModules = new Set<string>();
for (const sourceFile of new Set(discoveredActions.map((action) => action.sourceFile))) {
  const sourceNode = sourceFileFor(sourceFile);
  walk(sourceNode, (node) => {
    if (!ts.isCallExpression(node)) return;
    for (const argument of node.arguments) {
      if (ts.isStringLiteral(argument) && PROTECTED_FIELDS.has(argument.text)) {
        const call = node.getText(sourceNode);
        if (/\bformData\b/.test(call)) {
          protectedFormFieldsAcrossActionModules.add(
            `${sourceFile}#${argument.text}`,
          );
        }
      }
    }
  });
}
assert.deepEqual(
  [...protectedFormFieldsAcrossActionModules].toSorted(),
  [
    "src/app/account/team/actions.ts#role",
    "src/app/actions.ts#role",
    "src/app/admin/mutations.ts#id",
    "src/app/admin/mutations.ts#ownerId",
    "src/app/admin/mutations.ts#role",
    "src/app/admin/mutations.ts#userId",
  ],
  "helper functions must not hide additional protected FormData properties",
);

const organizationTeamServiceSource = read(
  "src/lib/organization-team-service.ts",
);
assert.match(
  organizationTeamServiceSource,
  /createOrganizationTeamInvitation[\s\S]*canInviteTeamRole\(authority, input\.role\)[\s\S]*team\.invitation_forbidden/,
);
assert.match(
  organizationTeamServiceSource,
  /changeOrganizationTeamMemberRole[\s\S]*canChangeTeamMemberRole\([\s\S]*nextRole: input\.role[\s\S]*team\.member_role_forbidden/,
);

const adminMutationSource = read("src/app/admin/mutations.ts");
assert.doesNotMatch(
  adminMutationSource,
  /Object\.fromEntries\s*\(\s*formData\s*\)/,
);
walk(sourceFileFor("src/app/admin/mutations.ts"), (node) => {
  if (!ts.isCallExpression(node) || callName(node.expression) !== "raw") return;
  assert.ok(
    node.arguments[1] && ts.isArrayLiteralExpression(node.arguments[1]),
    "admin raw() call sites must use a literal field allowlist",
  );
});

const hostile = Object.fromEntries(
  PROTECTED_MUTATION_FIELDS.map((field) => [field, "attacker-controlled"]),
);
assert.deepEqual(
  z.object({ title: z.string() }).parse({ title: "safe", ...hostile }),
  { title: "safe" },
  "default Zod object parsing must strip every unexpected authority field",
);
assert.equal(
  z.object({ title: z.string() }).strict().safeParse({ title: "safe", ...hostile })
    .success,
  false,
  "strict Zod object parsing must reject unexpected authority fields",
);

const hostileFixtures = [
  `async function POST(request: Request) {
    const body = await request.json();
    return prisma.user.update({ where: { id: "victim" }, data: body });
  }`,
  `async function POST(request: Request) {
    const payload = await request.json();
    return prisma.user.update({ where: { id: "victim" }, data: { ...payload } });
  }`,
  `async function POST(request: Request) {
    const input = await request.json();
    return updateUser(input);
  }`,
  `async function updateUserAction(formData: FormData) {
    "use server";
    return updateUser(formData);
  }`,
];
for (const [index, fixture] of hostileFixtures.entries()) {
  const fixtureFile = ts.createSourceFile(
    `hostile-${index}.ts`,
    fixture,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const fixtureHandler = findFunction(
    fixtureFile,
    index === hostileFixtures.length - 1 ? "updateUserAction" : "POST",
  );
  assert.ok(fixtureHandler);
  assert.ok(
    massAssignmentIssues(fixtureHandler, fixtureFile).length > 0,
    `hostile fixture ${index + 1} must be detected`,
  );
}

const safeFixture = ts.createSourceFile(
  "safe.ts",
  `async function POST(request: Request) {
    const body = await request.json();
    const parsed = updateSchema.parse(body);
    return updateUser(parsed);
  }`,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TS,
);
const safeHandler = findFunction(safeFixture, "POST");
assert.ok(safeHandler);
assert.deepEqual(massAssignmentIssues(safeHandler, safeFixture), []);

assert.deepEqual(
  Object.keys(PROPERTY_AUTHORIZATION_MASTER_EVIDENCE).toSorted(),
  [...PROPERTY_AUTHORIZATION_REQUIREMENT_IDS].toSorted(),
);
assert.equal(PROPERTY_AUTHORIZATION_RESIDUAL_RISKS.length, 3);
for (const residual of PROPERTY_AUTHORIZATION_RESIDUAL_RISKS) {
  assert.ok(residual.length > 80, "residual risks must remain explicit");
}
for (const fact of Object.keys(
  PROPERTY_AUTHORIZATION_FACTS,
) as PropertyAuthorizationFact[]) {
  const facts = { ...PROPERTY_AUTHORIZATION_FACTS, [fact]: false };
  const evaluation = evaluatePropertyAuthorizationFacts(facts);
  const evidence = buildPropertyAuthorizationMasterEvidence(facts);
  assert.equal(Object.values(evaluation).some((complete) => !complete), true);
  assert.equal(
    Object.keys(evidence).length,
    0,
    `${fact}: a missing proof must withhold property-authorization evidence`,
  );
}

console.log(
  `Property-authorization evidence passed: ${discoveredRoutes.length} HTTP mutations + ${discoveredActions.length} Server Actions, ${OBJECT_BODY_BOUNDARIES.length} object schemas, 31 verified gates`,
);

function body(method: string, sourceFile: string, schema: string) {
  return { key: mutationKey(method, sourceFile), schema };
}

function mutationKey(method: string, sourceFile: string) {
  return `${method} ${sourceFile}`;
}

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function sourceFileFor(path: string) {
  const sourceFile = program.getSourceFile(join(process.cwd(), path));
  assert.ok(sourceFile, `${path}: TypeScript program source missing`);
  return sourceFile;
}

function findIdentifier(sourceFile: ts.SourceFile, name: string) {
  let found: ts.Identifier | undefined;
  walk(sourceFile, (node) => {
    if (!found && ts.isIdentifier(node) && node.text === name) found = node;
  });
  return found;
}

function findFunction(sourceFile: ts.SourceFile, name: string) {
  let found: ts.FunctionLikeDeclaration | undefined;
  walk(sourceFile, (node) => {
    if (found) return;
    if (
      (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
      node.name?.text === name &&
      node.body
    ) {
      found = node;
      return;
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer)) &&
      ts.isBlock(node.initializer.body)
    ) {
      found = node.initializer;
    }
  });
  return found;
}

function walk(node: ts.Node, visit: (node: ts.Node) => void) {
  visit(node);
  node.forEachChild((child) => walk(child, visit));
}

function collectSchemaShape(
  schemaNode: ts.Identifier,
  typeChecker: ts.TypeChecker,
) {
  const fields = new Set<string>();
  const visited = new Set<ts.Symbol>();
  let objectSchemaFound = false;

  const scanSymbol = (symbol: ts.Symbol | undefined) => {
    if (!symbol) return;
    const resolved = symbol.flags & ts.SymbolFlags.Alias
      ? typeChecker.getAliasedSymbol(symbol)
      : symbol;
    if (visited.has(resolved)) return;
    visited.add(resolved);
    for (const declaration of resolved.declarations ?? []) {
      if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
        scanExpression(declaration.initializer);
      }
    }
  };

  const scanExpression = (expression: ts.Node) => {
    if (
      ts.isCallExpression(expression) &&
      ts.isPropertyAccessExpression(expression.expression) &&
      expression.expression.name.text === "object" &&
      expression.arguments[0] &&
      ts.isObjectLiteralExpression(expression.arguments[0])
    ) {
      objectSchemaFound = true;
      for (const property of expression.arguments[0].properties) {
        if (ts.isPropertyAssignment(property) || ts.isShorthandPropertyAssignment(property)) {
          const name = propertyName(property.name);
          if (name) fields.add(name);
        }
      }
    }

    if (ts.isIdentifier(expression) && /Schema$/.test(expression.text)) {
      scanSymbol(typeChecker.getSymbolAtLocation(expression));
    }
    expression.forEachChild(scanExpression);
  };

  scanSymbol(typeChecker.getSymbolAtLocation(schemaNode));
  return { fields, objectSchemaFound };
}

function propertyName(name: ts.PropertyName) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return undefined;
}

function collectFormDataFields(
  action: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
) {
  const formDataNames = new Set(
    action.parameters
      .filter((parameter) => parameter.type?.getText(sourceFile) === "FormData")
      .filter((parameter): parameter is ts.ParameterDeclaration & { name: ts.Identifier } =>
        ts.isIdentifier(parameter.name),
      )
      .map((parameter) => parameter.name.text),
  );
  const fields = new Set<string>();
  walk(action, (node) => {
    if (!ts.isCallExpression(node)) return;
    const first = node.arguments[0];
    const second = node.arguments[1];
    if (
      first &&
      ts.isIdentifier(first) &&
      formDataNames.has(first.text) &&
      second &&
      ts.isStringLiteral(second)
    ) {
      fields.add(second.text);
    }
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      formDataNames.has(node.expression.expression.text) &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      fields.add(node.arguments[0].text);
    }
  });
  return fields;
}

function massAssignmentIssues(
  handler: ts.FunctionLikeDeclaration,
  sourceFile: ts.SourceFile,
) {
  const rawObjects = new Set<string>();
  for (const parameter of handler.parameters) {
    if (
      ts.isIdentifier(parameter.name) &&
      parameter.type?.getText(sourceFile) === "FormData"
    ) {
      rawObjects.add(parameter.name.text);
    }
  }

  walk(handler, (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      !isSchemaParse(node.initializer) &&
      isRawRequestSource(node.initializer.getText(sourceFile))
    ) {
      rawObjects.add(node.name.text);
    }
  });

  const issues = new Set<string>();
  walk(handler, (node) => {
    if (
      ts.isSpreadAssignment(node) &&
      ((ts.isIdentifier(node.expression) && rawObjects.has(node.expression.text)) ||
        isRawRequestSource(node.expression.getText(sourceFile)))
    ) {
      issues.add(`raw spread: ${node.getText(sourceFile)}`);
    }
    if (
      ts.isPropertyAssignment(node) &&
      propertyName(node.name) === "data" &&
      (containsRaw(node.initializer, rawObjects) ||
        isRawRequestSource(node.initializer.getText(sourceFile)))
    ) {
      issues.add(`raw data assignment: ${node.getText(sourceFile)}`);
    }
    if (!ts.isCallExpression(node)) return;
    const callee = callName(node.expression);
    const allowed =
      isSchemaParse(node) ||
      callee === "JSON.parse" ||
      [
        "field",
        "fields",
        "listingAttributes",
        "moderationReason",
        "raw",
        "optionalField",
        "nullableNumberField",
        "optionalDateField",
        "checkbox",
        "optionalBoolean",
        "lines",
        "optional",
        "firstMedia",
        "customPageMediaFields",
      ].includes(callee);
    if (allowed) return;
    for (const argument of node.arguments) {
      if (
        (ts.isIdentifier(argument) && rawObjects.has(argument.text)) ||
        isRawRequestSource(argument.getText(sourceFile))
      ) {
        issues.add(`raw object forwarded to ${callee}`);
      }
    }
  });
  return [...issues].toSorted();
}

function isSchemaParse(node: ts.Node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    ["parse", "safeParse"].includes(node.expression.name.text)
  );
}

function containsRaw(node: ts.Node, rawObjects: Set<string>) {
  let found = false;
  walk(node, (child) => {
    if (ts.isIdentifier(child) && rawObjects.has(child.text)) found = true;
  });
  return found;
}

function isRawRequestSource(source: string) {
  return /request\.json\s*\(|Object\.fromEntries\s*\(|JSON\.parse\s*\(|readBounded(?:Json|OptionalJson|JsonOrForm)Request\s*\(/.test(
    source,
  );
}

function callName(expression: ts.LeftHandSideExpression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) {
    return `${expression.expression.getText()}.${expression.name.text}`;
  }
  return expression.getText();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
