export const CONVERSATION_OBJECT_AUTHORIZATION_EVIDENCE_FILE =
  "security/conversation-object-authorization-evidence.ts" as const;
export const CONVERSATION_OBJECT_AUTHORIZATION_TEST_FILE =
  "security/conversation-object-authorization-evidence.test.ts" as const;

export const CONVERSATION_OBJECT_AUTHORIZATION_SCOPE =
  "Source and unit evidence for every HTTP handler under /api/conversations/[id]. Each handler derives the current profile on the server and delegates the supplied conversation identifier to a service that first resolves the conversation with a participant predicate. Message deletion and reaction operations additionally bind the supplied message identifier to that authorized conversation and current participant. This closes only conversation-id and message-id object authorization in the implemented conversation API; it does not claim deployed-database parity, authorization for other object types, or complete cross-role endpoint testing.";

export const CONVERSATION_OBJECT_AUTHORIZATION_REQUIREMENT_IDS = [
  "security.object-authorization.conversation-id",
  "security.object-authorization.message-id",
] as const;

const EVIDENCE = [
  CONVERSATION_OBJECT_AUTHORIZATION_EVIDENCE_FILE,
  CONVERSATION_OBJECT_AUTHORIZATION_TEST_FILE,
  "src/app/api/conversations/[id]/route.ts",
  "src/app/api/conversations/[id]/block/route.ts",
  "src/app/api/conversations/[id]/delivered/route.ts",
  "src/app/api/conversations/[id]/messages/route.ts",
  "src/app/api/conversations/[id]/messages/[msgId]/route.ts",
  "src/app/api/conversations/[id]/read/route.ts",
  "src/app/api/conversations/[id]/search/route.ts",
  "src/lib/conversation-service.ts",
  "src/lib/realtime-authorization.test.ts",
] as const;

export const CONVERSATION_OBJECT_AUTHORIZATION_MASTER_EVIDENCE =
  Object.fromEntries(
    CONVERSATION_OBJECT_AUTHORIZATION_REQUIREMENT_IDS.map((requirementId) => [
      requirementId,
      { status: "verified" as const, evidence: EVIDENCE },
    ]),
  );
