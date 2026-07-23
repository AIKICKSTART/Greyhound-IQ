import type { FamilyScreenManifest } from "./types";

export const PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST = {
  id: "PRODUCTION-SCREEN-PROFILE-MESSAGING-INTERACTIONS",
  path: "src/components/screen-contracts/production-screen-profile-messaging-interactions.test.ts",
} as const;

const TEST_IDS = [
  PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_EVIDENCE_TEST.id,
] as const;

type InteractionContract = {
  queryParameters: readonly string[];
  actions: FamilyScreenManifest["actions"];
  forms: FamilyScreenManifest["forms"];
};

type InteractionAction = FamilyScreenManifest["actions"][number];
type InteractionForm = FamilyScreenManifest["forms"][number];

function action(
  id: string,
  result: string,
  enforcement: string,
): InteractionAction {
  return { id, result, enforcement, testIds: TEST_IDS };
}

function form(id: string, submitsTo: string, schema: string): InteractionForm {
  return { id, submitsTo, schema, testIds: TEST_IDS };
}

export const PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_ROUTES = [
  "/messages",
  "/messages/[id]",
  "/messages/friends",
  "/p/[handle]",
] as const;

export const PRODUCTION_SCREEN_PROFILE_MESSAGING_INTERACTION_CONTRACTS = {
  "/messages": {
    queryParameters: [],
    actions: [
      action(
        "MESSAGES.ACTION.CONVERSATION.OPEN",
        "Opens a participant-visible private conversation on its canonical Pulse route.",
        "Conversation links use identifiers returned by listConversationsForProfile through the current profile's request context.",
      ),
      action(
        "MESSAGES.ACTION.MESSAGE.SEND",
        "Starts or reuses a conversation and sends a bounded private message.",
        "sendMessage requires the current profile, applies a per-user rate limit, parses messageSchema, and delegates participant, block, moderation, and media checks to conversation services.",
      ),
      action(
        "MESSAGES.ACTION.FRIENDS.OPEN",
        "Opens the current member's canonical Pulse friends directory.",
        "The fixed same-origin Link targets /pulse/friends, whose page scopes friends to the current profile.",
      ),
      action(
        "MESSAGES.ACTION.FRIEND.CONVERSATION.OPEN",
        "Opens an existing friend conversation from its message, voice, or video affordance.",
        "All three affordances use the conversation identifier returned by the participant-scoped friend read; call controls are gated inside the conversation.",
      ),
      action(
        "MESSAGES.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to use private messaging.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in; all message mutation paths independently require the current profile.",
      ),
    ],
    forms: [
      form(
        "MESSAGES.FORM.MESSAGE",
        "SERVER ACTION sendMessage",
        "recipientProfileId:loaded-recipient-id,body:trimmed-string(1..5000),mediaIds<=4",
      ),
    ],
  },
  "/messages/[id]": {
    queryParameters: ["call"],
    actions: [
      action(
        "MESSAGE-THREAD.ACTION.MESSAGE.SEND",
        "Sends a bounded reply with clean attachable media to the loaded conversation.",
        "POST /api/conversations/[id]/messages requires the current profile, rate-limits the conversation, parses conversationMessageSchema, and delegates participant, block, moderation, and media checks to the service.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.CALL.MANAGE",
        "Starts, joins, responds to, retries, configures, or leaves an eligible voice or video call.",
        "Call APIs require the current profile and conversation participation; call creation is tier-gated to pro_plus server-side and the client controls only the connected LiveKit room's local media.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.REACTION.TOGGLE",
        "Toggles the current participant's reaction on a loaded message from the per-message menu.",
        "toggleMessageReaction requires the current profile, rate-limits the message pair, and the service verifies both conversation participation and visible message membership.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.MESSAGE.DELETE",
        "Soft-deletes the current participant's loaded message copy from the per-message menu.",
        "deleteConversationMessage requires the current profile and the service verifies conversation participation and message membership before recording the participant-specific deletion.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.MESSAGE.REPORT",
        "Reports another participant's loaded message from the per-message menu.",
        "reportConversationMessage requires the current profile, rate-limits the message pair, verifies conversation membership, rejects self-reporting, and parses reportCreateSchema.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.ATTACHMENT.OPEN",
        "Opens or plays a clean, ready message attachment.",
        "The consolidated surface emits blob or processed-media URLs only after the participant-scoped message read reports clean scan status and ready processing status.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.CONVERSATION.OPEN",
        "Opens another conversation from the Pulse panel inside the consolidated surface.",
        "Conversation identifiers come from the participant-scoped inbox query for the current profile.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.FRIEND.RESPOND",
        "Accepts or declines an incoming friend request from the panel's Requests tab.",
        "respondToFriendRequestAction requires the current profile and the friend service verifies the request is addressed to that profile.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.FRIEND.FIND",
        "Searches members and sends friend requests inline from the panel's Friends tab.",
        "Add-friend search reads bounded member results for the current profile and sendFriendRequestAction enforces per-profile rate limits server-side.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.INBOX.OPEN",
        "Returns to the canonical Pulse inbox.",
        "The fixed same-origin Link targets /pulse.",
      ),
      action(
        "MESSAGE-THREAD.ACTION.SIGN-IN.OPEN",
        "Opens sign-in when a visitor reaches a private conversation route.",
        "The signed-out fallback renders a fixed same-origin anchor to /sign-in before any conversation read occurs.",
      ),
    ],
    forms: [
      form(
        "MESSAGE-THREAD.FORM.MESSAGE",
        "POST /api/conversations/[id]/messages",
        "conversationId:path-bound-participant-conversation-id,body:trimmed-string(1..5000),mediaIds<=4",
      ),
      form(
        "MESSAGE-THREAD.FORM.FRIEND-ACCEPT",
        "SERVER ACTION respondToFriendRequestAction",
        "requestId:server-bound-incoming-request-id,response:accept",
      ),
      form(
        "MESSAGE-THREAD.FORM.FRIEND-DECLINE",
        "SERVER ACTION respondToFriendRequestAction",
        "requestId:server-bound-incoming-request-id,response:decline",
      ),
    ],
  },
  "/messages/friends": {
    queryParameters: [],
    actions: [
      action(
        "MESSAGES-FRIENDS.ACTION.INBOX.OPEN",
        "Returns to the canonical Pulse inbox.",
        "The fixed same-origin Link targets /pulse.",
      ),
      action(
        "MESSAGES-FRIENDS.ACTION.CONVERSATION.OPEN",
        "Opens an existing friend conversation from its message, voice, or video affordance.",
        "All three affordances use a conversation identifier returned by listFriendsForProfile through the current profile's request context.",
      ),
      action(
        "MESSAGES-FRIENDS.ACTION.SIGN-IN.OPEN",
        "Opens sign-in for a visitor who wants to view friends.",
        "The signed-out branch renders a fixed same-origin anchor to /sign-in before any private friend read occurs.",
      ),
    ],
    forms: [
      form(
        "MESSAGES-FRIENDS.FORM.REQUEST-ACCEPT",
        "SERVER ACTION respondToFriendRequestAction",
        "friendshipId:incoming-request-friendship-id(max120),response:accept",
      ),
      form(
        "MESSAGES-FRIENDS.FORM.REQUEST-DECLINE",
        "SERVER ACTION respondToFriendRequestAction",
        "friendshipId:incoming-request-friendship-id(max120),response:decline",
      ),
    ],
  },
  "/p/[handle]": {
    queryParameters: [],
    actions: [
      action(
        "PROFILE.ACTION.MANAGE.OPEN",
        "Opens the current owner's account, profile-media, or managed-page editor.",
        "Owner controls render only when getSocialActorProfileByHandle marks the viewer as owner; each fixed account destination independently enforces its authenticated ownership boundary.",
      ),
      action(
        "PROFILE.ACTION.SIGN-IN.OPEN",
        "Opens sign-in when a visitor wants to connect with, follow, or message the profile.",
        "The visitor branches use the fixed same-origin /sign-in destination, while every mutation independently requires the current profile.",
      ),
      action(
        "PROFILE.ACTION.FRIEND.REQUEST",
        "Sends a friend request to a loaded personal profile.",
        "sendFriendRequestAction requires the current profile, rate-limits the caller, and parses the server-submitted profile identifier; the service rejects self, blocked, missing, banned, or deletion-pending recipients before its request-context write and audit event.",
      ),
      action(
        "PROFILE.ACTION.FRIENDS.OPEN",
        "Opens the canonical friend-request or friend-discovery surface.",
        "Incoming-request and empty-friend branches use the fixed same-origin /pulse/friends destination, whose data is scoped to the current profile.",
      ),
      action(
        "PROFILE.ACTION.CHAT.START",
        "Starts or reuses a private conversation with the loaded personal or page identity.",
        "startChatAction requires the current profile, rate-limits the caller, and parses the loaded identifier; startOrGetConversation resolves only a published actor or profile through the request context and enforces self, block, recipient, and page-tier rules.",
      ),
      action(
        "PROFILE.ACTION.FOLLOW.TOGGLE",
        "Follows or unfollows a loaded published managed page.",
        "toggleActorFollowAction requires the current profile, rate-limits the caller, and parses the loaded actor identifier; toggleActorFollow accepts only a published page, rejects self and blocked relationships, and writes through the request context.",
      ),
      action(
        "PROFILE.ACTION.CONTENT.OPEN",
        "Opens visible feed posts, friends, listings, or section anchors associated with the loaded profile.",
        "getSocialActorProfileByHandle normalises the handle, loads only published non-removed actors, rejects blocked viewers, and filters timeline and related records by audience before their identifiers reach links.",
      ),
      action(
        "PROFILE.ACTION.CONTACT.OPEN",
        "Opens an audience-visible email, phone, or website contact destination.",
        "Contact links render only when the actor's contact audience permits the viewer; external websites open with noopener, noreferrer, and nofollow protections.",
      ),
    ],
    forms: [
      form(
        "PROFILE.FORM.PRIVATE-FRIEND-REQUEST",
        "SERVER ACTION sendFriendRequestAction",
        "profileId:loaded-private-personal-profile-id(max120),visibility:connections",
      ),
      form(
        "PROFILE.FORM.FRIEND-REQUEST",
        "SERVER ACTION sendFriendRequestAction",
        "profileId:loaded-personal-profile-id(max120)",
      ),
      form(
        "PROFILE.FORM.PERSONAL-CHAT",
        "SERVER ACTION startChatAction",
        "profileId:loaded-personal-profile-id(max120),senderActorId:omitted-personal-identity",
      ),
      form(
        "PROFILE.FORM.PAGE-FOLLOW",
        "SERVER ACTION toggleActorFollowAction",
        "actorId:loaded-published-page-actor-id(max120)",
      ),
      form(
        "PROFILE.FORM.PAGE-CHAT",
        "SERVER ACTION startChatAction",
        "profileId:loaded-published-page-actor-id(max120),senderActorId:omitted-personal-identity",
      ),
    ],
  },
} as const satisfies Readonly<Record<string, InteractionContract>>;
