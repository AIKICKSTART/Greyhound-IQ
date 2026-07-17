import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

import { isAdminRole, isModeratorRole } from "../src/lib/auth-roles";
import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  AUTHORIZATION_ACTOR_MASTER_EVIDENCE,
  SERVER_AUTHORITY_REQUIREMENT_IDS,
} from "./authorization-actor-evidence";

const authSource = readFileSync("src/lib/auth.ts", "utf8");
const currentUserGuard = namedFunctionSource(
  authSource,
  "src/lib/auth.ts",
  "requireCurrentUserProfile",
);
const moderatorGuard = namedFunctionSource(
  authSource,
  "src/lib/auth.ts",
  "requireModeratorProfile",
);
const administratorGuard = namedFunctionSource(
  authSource,
  "src/lib/auth.ts",
  "requireAdminProfile",
);

for (const marker of [
  "const { user } = await withAuth()",
  'if (!user)',
  'throw new Error("auth.unauthorized")',
  "const dbUser = await syncAuthUser(user)",
  "if (dbUser.isBanned)",
  'throw new Error("auth.forbidden")',
  "tier: normalizeTier(dbUser.subscriptionTier)",
  "role: profile.role",
  "profileRole: profile.role",
]) {
  assert.ok(currentUserGuard.includes(marker), `current-user guard: ${marker}`);
}
assert.match(currentUserGuard, /requireCurrentUserProfile\(\)/);

assert.match(
  moderatorGuard,
  /requireCurrentUserProfile\(\)[\s\S]*isModeratorRole\(current\.profileRole\)[\s\S]*auth\.forbidden/,
);
assert.match(
  administratorGuard,
  /requireCurrentUserProfile\(\)[\s\S]*isAdminRole\(current\.profileRole\)[\s\S]*auth\.forbidden/,
);
assert.equal(isModeratorRole("member"), false);
assert.equal(isModeratorRole("moderator"), true);
assert.equal(isAdminRole("moderator"), false);
assert.equal(isAdminRole("admin"), true);

const applicationSources = collectSourceFiles("src/app").map((path) => ({
  path,
  source: readFileSync(path, "utf8"),
}));
const minimumGuardCalls = {
  requireCurrentUserProfile: 120,
  requireModeratorProfile: 25,
  requireAdminProfile: 40,
} as const;
for (const [guard, minimum] of Object.entries(minimumGuardCalls)) {
  const guardedSources = applicationSources.filter(({ source }) =>
    new RegExp(`\\b${guard}\\s*\\(`).test(source),
  );
  const calls = guardedSources.reduce(
    (total, { source }) =>
      total + (source.match(new RegExp(`\\b${guard}\\s*\\(`, "g"))?.length ?? 0),
    0,
  );
  assert.ok(calls >= minimum, `${guard}: only ${calls} server call sites`);
  for (const { path, source } of guardedSources) {
    assert.doesNotMatch(
      source,
      /^\s*["']use client["'];/,
      `${path}: server authority guard imported into a client module`,
    );
  }
}

const mergedEvidence = SECURITY_MASTER_EVIDENCE as Record<string, unknown>;
const familyEvidence = AUTHORIZATION_ACTOR_MASTER_EVIDENCE as Record<
  string,
  unknown
>;
for (const requirementId of SERVER_AUTHORITY_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: missing immutable requirement`);
  assert.deepEqual(mergedEvidence[requirementId], familyEvidence[requirementId]);
  assert.equal(isMasterRequirementComplete(requirement), true);
}

console.log(
  "server authority evidence passed: nine identity, session, role, plan, staff, and deny-by-default controls verified",
);

function namedFunctionSource(source: string, file: string, name: string) {
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const declarations: ts.FunctionDeclaration[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) {
      declarations.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  assert.equal(declarations.length, 1, `${file}: expected one ${name}`);
  return declarations[0]!.getText(sourceFile);
}

function collectSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectSourceFiles(path);
    return /\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}
