import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";

import { SECURITY_MASTER_EVIDENCE } from "../src/components/master-audit-evidence";
import {
  MASTER_AUDIT_REQUIREMENTS,
  isMasterRequirementComplete,
} from "../src/components/master-audit-requirements";
import {
  MEMBER_OBJECT_AUTHORIZATION_MASTER_EVIDENCE,
  MEMBER_OBJECT_AUTHORIZATION_REQUIREMENT_IDS,
  MEMBER_OBJECT_AUTHORIZATION_SCOPE,
} from "./member-object-authorization-evidence";

const postRoutes = [
  "src/app/api/feed/[postId]/comments/route.ts",
  "src/app/api/feed/[postId]/reaction/route.ts",
  "src/app/api/feed/[postId]/route.ts",
  "src/app/api/feed/[postId]/save/route.ts",
  "src/app/api/feed/[postId]/share/route.ts",
] as const;
const commentRoutes = [
  "src/app/api/feed/comments/[commentId]/reaction/route.ts",
  "src/app/api/feed/comments/[commentId]/route.ts",
] as const;

assert.deepEqual(MEMBER_OBJECT_AUTHORIZATION_REQUIREMENT_IDS, [
  "security.object-authorization.post-id",
  "security.object-authorization.comment-id",
  "security.object-authorization.ai-run-id",
]);
assert.match(MEMBER_OBJECT_AUTHORIZATION_SCOPE, /every implemented API route/i);
assert.match(MEMBER_OBJECT_AUTHORIZATION_SCOPE, /does not claim deployed-database parity/i);
assert.deepEqual(discoverApiRoutesWith("postId"), postRoutes);
assert.deepEqual(discoverApiRoutesWith("commentId"), commentRoutes);

const routeCalls = {
  "src/app/api/feed/[postId]/route.ts": [
    "getFeedPostForViewer",
    "editFeedPostForCurrentUser",
    "deleteFeedPostForCurrentUser",
  ],
  "src/app/api/feed/[postId]/comments/route.ts": [
    "getFeedCommentsForViewer",
    "createFeedCommentForCurrentUser",
  ],
  "src/app/api/feed/[postId]/reaction/route.ts": [
    "toggleFeedPostReactionForCurrentUser",
  ],
  "src/app/api/feed/[postId]/save/route.ts": [
    "toggleSavedFeedPostForCurrentUser",
  ],
  "src/app/api/feed/[postId]/share/route.ts": [
    "shareFeedPostForCurrentUser",
  ],
  "src/app/api/feed/comments/[commentId]/route.ts": [
    "editFeedCommentForCurrentUser",
    "deleteFeedCommentForCurrentUser",
  ],
  "src/app/api/feed/comments/[commentId]/reaction/route.ts": [
    "toggleFeedCommentReactionForCurrentUser",
  ],
} as const;
for (const [path, calls] of Object.entries(routeCalls)) {
  const source = read(path);
  for (const call of calls) assert.match(source, new RegExp(`\\b${call}\\(`));
}
for (const path of [...postRoutes, ...commentRoutes]) {
  const source = read(path);
  if (/export async function (?:POST|PATCH|DELETE)/.test(source)) {
    assert.match(source, /requireCurrentUserProfile\(\)/, `${path}: server identity`);
  }
}

const feed = read("src/lib/feed-service.ts");
for (const name of [
  "getFeedPostForViewer",
  "getFeedCommentsForViewer",
  "createFeedCommentForCurrentUser",
  "toggleFeedPostReactionForCurrentUser",
  "toggleSavedFeedPostForCurrentUser",
  "shareFeedPostForCurrentUser",
  "editFeedPostForCurrentUser",
  "deleteFeedPostForCurrentUser",
  "editFeedCommentForCurrentUser",
  "deleteFeedCommentForCurrentUser",
  "toggleFeedCommentReactionForCurrentUser",
]) {
  assert.match(exportedFunction(feed, name), /withDb(?:Request|Anonymous)Context/);
}

for (const name of ["editFeedPostForCurrentUser", "deleteFeedPostForCurrentUser"]) {
  const source = exportedFunction(feed, name);
  assert.match(
    source,
    /where: \{ id: postId, authorProfileId: current\.profileId, deletedAt: null \}/,
  );
  assertInOrder(source, ["authorProfileId: current.profileId", "tx.feedPost.update"]);
  assert.match(source, /throw new Error\("feed\.post_not_found"\)/);
}
for (const name of [
  "getFeedPostForViewer",
  "getFeedCommentsForViewer",
  "createFeedCommentForCurrentUser",
  "toggleFeedPostReactionForCurrentUser",
  "toggleSavedFeedPostForCurrentUser",
  "shareFeedPostForCurrentUser",
]) {
  const source = exportedFunction(feed, name);
  assert.match(source, /id: postId/);
  assert.match(source, /throw new Error\("feed\.post_not_found"\)/);
}
const commentsForViewer = exportedFunction(feed, "getFeedCommentsForViewer");
assert.match(
  commentsForViewer,
  /where: \{ id: options\.cursor, postId, parentCommentId: null \}/,
);
const createComment = exportedFunction(feed, "createFeedCommentForCurrentUser");
assert.match(
  createComment,
  /id: parentCommentId,[\s\S]*postId,[\s\S]*parentCommentId: null/,
);
for (const name of ["editFeedCommentForCurrentUser", "deleteFeedCommentForCurrentUser"]) {
  const source = exportedFunction(feed, name);
  assert.match(source, /id: commentId,[\s\S]{0,120}authorProfileId: current\.profileId/);
  assertInOrder(source, ["authorProfileId: current.profileId", "tx.feedComment.update"]);
  assert.match(source, /throw new Error\("feed\.comment_not_found"\)/);
}
const commentReaction = exportedFunction(feed, "toggleFeedCommentReactionForCurrentUser");
assert.match(commentReaction, /id: commentId, status: "active", deletedAt: null/);
assert.match(commentReaction, /throw new Error\("feed\.comment_not_found"\)/);

const feedRls = read(
  "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
);
assert.match(feedRls, /CREATE POLICY giq_feed_post_select[\s\S]*giq_feed_post_visible\(id\)/);
assert.match(feedRls, /CREATE POLICY giq_feed_post_update[\s\S]*authorProfileId/);
assert.match(feedRls, /CREATE POLICY giq_feed_comment_update[\s\S]*authorProfileId/);
assert.match(feedRls, /CREATE POLICY giq_feed_reaction_insert[\s\S]*giq_feed_post_visible/);
assert.match(
  read("prisma/migrations/20260710135500_blocked_feed_comment_visibility/migration.sql"),
  /CREATE POLICY giq_feed_comment_select[\s\S]*giq_feed_post_visible\("postId"\)/,
);

for (const path of [
  "src/app/api/agents/runs/[id]/route.ts",
  "src/app/api/agents/runs/[id]/cancel/route.ts",
]) {
  const source = read(path);
  assert.match(source, /requireCurrentUserProfile\(\)/);
  assert.match(source, /(?:get|cancel)AgentRunForCurrentUser\(current, id\)/);
}
const agentService = read("src/lib/agent-service.ts");
const getRun = exportedFunction(agentService, "getAgentRunForCurrentUser");
assertInOrder(getRun, [
  "tx.agentRun.findUnique({ where: { id: runId } })",
  "run.userId !== current.dbUserId",
  'throw new Error("agent.run_not_found")',
]);
const cancelRun = exportedFunction(agentService, "cancelAgentRunForCurrentUser");
assertInOrder(cancelRun, [
  "getAgentRunForCurrentUser(current, runId)",
  "tx.agentRun.update",
]);

for (const requirementId of MEMBER_OBJECT_AUTHORIZATION_REQUIREMENT_IDS) {
  const requirement = MASTER_AUDIT_REQUIREMENTS.find(
    (candidate) => candidate.id === requirementId,
  );
  assert.ok(requirement, `${requirementId}: immutable requirement missing`);
  assert.deepEqual(
    SECURITY_MASTER_EVIDENCE[requirementId],
    MEMBER_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[requirementId],
  );
  assert.equal(isMasterRequirementComplete(requirement), true);
  for (const path of MEMBER_OBJECT_AUTHORIZATION_MASTER_EVIDENCE[requirementId]
    .evidence) {
    assert.equal(existsSync(path), true, path);
  }
}

console.log(
  "Member object authorization evidence passed: all post/comment API routes and current-member AI-run ownership guards verified",
);

function read(path: string) {
  return readFileSync(path, "utf8");
}

function exportedFunction(source: string, name: string) {
  const sourceFile = ts.createSourceFile(
    "member-object-authorization.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const match = sourceFile.statements.find(
    (statement): statement is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(statement) && statement.name?.text === name,
  );
  assert.ok(match, `${name}: exported function missing`);
  return match.getText(sourceFile);
}

function discoverApiRoutesWith(identifier: string) {
  const root = "src/app/api";
  const found: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (
        entry.name === "route.ts" &&
        new RegExp(`\\b${identifier}\\b`).test(read(path))
      ) {
        found.push(relative(".", path).replaceAll("\\", "/"));
      }
    }
  };
  visit(root);
  return found.toSorted();
}

function assertInOrder(source: string, expected: readonly string[]) {
  let previous = -1;
  for (const value of expected) {
    const index = source.indexOf(value);
    assert.ok(index > previous, `missing or out of order: ${value}`);
    previous = index;
  }
}
