export const MEMBER_OBJECT_AUTHORIZATION_EVIDENCE_FILE =
  "security/member-object-authorization-evidence.ts" as const;
export const MEMBER_OBJECT_AUTHORIZATION_TEST_FILE =
  "security/member-object-authorization-evidence.test.ts" as const;

export const MEMBER_OBJECT_AUTHORIZATION_SCOPE =
  "Source and unit evidence for every implemented API route accepting a feed post id, feed comment id or member AI-run id. Feed reads and interactions execute in anonymous or current-member database contexts backed by feed visibility RLS; author-only edits and deletes bind the identifier to the current profile before mutation. AI-run reads reject a missing or foreign owner before cancellation can update the run. This closes only the three named object-identifier requirements; it does not claim deployed-database parity, other object types or complete cross-role endpoint testing.";

export const MEMBER_OBJECT_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.object-authorization.post-id",
  "security.object-authorization.comment-id",
  "security.object-authorization.ai-run-id",
] as const;

const EVIDENCE = [
  MEMBER_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
  MEMBER_OBJECT_AUTHORIZATION_TEST_FILE,
  "src/app/api/feed/[postId]/route.ts",
  "src/app/api/feed/[postId]/comments/route.ts",
  "src/app/api/feed/[postId]/reaction/route.ts",
  "src/app/api/feed/[postId]/save/route.ts",
  "src/app/api/feed/[postId]/share/route.ts",
  "src/app/api/feed/comments/[commentId]/route.ts",
  "src/app/api/feed/comments/[commentId]/reaction/route.ts",
  "src/app/api/agents/runs/[id]/route.ts",
  "src/app/api/agents/runs/[id]/cancel/route.ts",
  "src/lib/feed-service.ts",
  "src/lib/agent-service.ts",
  "src/lib/db-context.ts",
  "prisma/migrations/20260710134000_add_social_actor_media_foundation/migration.sql",
  "prisma/migrations/20260710135500_blocked_feed_comment_visibility/migration.sql",
  "prisma/migrations/20260710142000_fix_feed_post_returning_rls/migration.sql",
] as const;

export const MEMBER_OBJECT_AUTHORIZATION_MASTER_EVIDENCE = Object.fromEntries(
  MEMBER_OBJECT_AUTHORIZATION_REQUIREMENT_IDS.map((requirementId) => [
    requirementId,
    { status: "verified" as const, evidence: EVIDENCE },
  ]),
);

