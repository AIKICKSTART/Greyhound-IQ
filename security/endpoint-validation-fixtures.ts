import type { ZodType } from "zod";

import {
  accountDeletionRequestSchema,
  accountMarketingPreferenceSchema,
  dogOwnershipClaimSchema,
  profileUpdateSchema,
} from "../src/lib/account-validation";
import { agentRunSchema } from "../src/lib/agent-validation";
import { billingCheckoutRequestSchema } from "../src/lib/billing/checkout-validation";
import {
  callInviteActionSchema,
  callRoomCreateSchema,
} from "../src/lib/call-validation";
import {
  conversationMessageSchema,
  conversationStartSchema,
  legacyConversationMessageSchema,
} from "../src/lib/conversation-validation";
import {
  feedActorSelectionSchema,
  feedCommentEditSchema,
  feedCommentWriteSchema,
  feedPostEditSchema,
  feedPostWriteSchema,
  feedReactionWriteSchema,
  feedShareWriteSchema,
} from "../src/lib/feed-validation";
import {
  forumPostCreateSchema,
  forumThreadCreateSchema,
} from "../src/lib/forum-validation";
import {
  listingEnquirySchema,
  listingPatchSchema,
  listingWriteSchema,
} from "../src/lib/listing-validation";
import {
  mediaFinalizeSchema,
  mediaMetadataUpdateSchema,
  mediaSignUploadSchema,
} from "../src/lib/media-validation";
import {
  memoryCreateSchema,
  memorySupersedeSchema,
} from "../src/lib/memory-validation";
import {
  reportCreateSchema,
  reportResolveSchema,
} from "../src/lib/report-validation";

export type EndpointHostileCaseKind =
  | "missing-required-field"
  | "null"
  | "empty-string"
  | "excessively-long-value"
  | "out-of-range-number"
  | "invalid-enumeration"
  | "unexpected-fields"
  | "invalid-nested-object"
  | "oversized-array"
  | "invalid-url"
  | "wrong-type";

type HostileExpectation = "reject" | "accept" | "reject-or-strip";

export type EndpointHostileCase = {
  kind: EndpointHostileCaseKind;
  input: unknown;
  expectation?: HostileExpectation;
  strippedKey?: string;
};

export type EndpointValidationFixture = {
  endpoint: string;
  schema: ZodType;
  valid: Record<string, unknown>;
  cases: readonly EndpointHostileCase[];
};

const unexpectedKey = "__unexpectedSecurityField";
const long = (length: number) => "x".repeat(length);
const ids = (length: number) =>
  Array.from({ length }, (_, index) => `media_${index + 1}`);

function hostile(
  kind: EndpointHostileCaseKind,
  input: unknown,
  expectation: HostileExpectation = "reject",
): EndpointHostileCase {
  return { kind, input, expectation };
}

function fixture(
  endpoint: string,
  schema: ZodType,
  valid: Record<string, unknown>,
  cases: readonly EndpointHostileCase[],
): EndpointValidationFixture {
  return {
    endpoint,
    schema,
    valid,
    cases: [
      hostile("null", null),
      hostile("wrong-type", "not-an-object"),
      {
        kind: "unexpected-fields",
        input: { ...valid, [unexpectedKey]: "attacker-controlled" },
        expectation: "reject-or-strip",
        strippedKey: unexpectedKey,
      },
      ...cases,
    ],
  };
}

export const ENDPOINT_VALIDATION_FIXTURES = [
  fixture("POST /api/actors/[actorId]/mute", feedActorSelectionSchema, {}, [
    hostile("empty-string", { actorId: "" }),
    hostile("excessively-long-value", { actorId: long(121) }),
  ]),
  fixture(
    "POST /api/agents/[type]/run",
    agentRunSchema,
    { input: "Analyse race seven" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { input: "" }),
      hostile("excessively-long-value", { input: long(5_001) }),
    ],
  ),
  fixture(
    "POST /api/billing/checkout",
    billingCheckoutRequestSchema,
    { plan: "pro", interval: "monthly" },
    [
      hostile("missing-required-field", { interval: "monthly" }),
      hostile("empty-string", { plan: "", interval: "monthly" }),
      hostile("excessively-long-value", {
        plan: long(20),
        interval: "monthly",
      }),
      hostile("invalid-enumeration", { plan: "pro", interval: "weekly" }),
    ],
  ),
  fixture(
    "POST /api/calls/[roomId]/invite",
    callInviteActionSchema,
    { action: "accept" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { action: "" }),
      hostile("excessively-long-value", { action: long(20) }),
      hostile("invalid-enumeration", { action: "forward" }),
    ],
  ),
  fixture(
    "POST /api/calls/rooms",
    callRoomCreateSchema,
    { conversationId: "conversation_1", callType: "video" },
    [
      hostile("missing-required-field", { callType: "video" }),
      hostile("empty-string", { conversationId: "", callType: "video" }),
      hostile("excessively-long-value", {
        conversationId: long(121),
        callType: "video",
      }),
      hostile("invalid-enumeration", {
        conversationId: "conversation_1",
        callType: "hologram",
      }),
    ],
  ),
  fixture(
    "POST /api/conversations",
    conversationStartSchema,
    { recipientProfileId: "profile_1" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { recipientProfileId: "" }),
      hostile("excessively-long-value", { recipientProfileId: long(121) }),
    ],
  ),
  fixture(
    "POST /api/conversations/[id]/messages",
    conversationMessageSchema,
    { body: "Race update" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { body: "" }),
      hostile("excessively-long-value", { body: long(5_001) }),
      hostile("oversized-array", { body: "Race update", mediaIds: ids(5) }),
    ],
  ),
  fixture(
    "POST /api/dogs/[id]/claim",
    dogOwnershipClaimSchema,
    { role: "owner" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { role: "" }),
      hostile("excessively-long-value", { role: long(20) }),
      hostile("invalid-enumeration", { role: "spectator" }),
    ],
  ),
  fixture("POST /api/feed", feedPostWriteSchema, { body: "Race update" }, [
    hostile("missing-required-field", {}),
    hostile("empty-string", { body: "" }),
    hostile("excessively-long-value", { body: long(5_001) }),
    hostile("invalid-enumeration", {
      body: "Race update",
      visibility: "worldwide",
    }),
    hostile("oversized-array", { body: "Race update", mediaIds: ids(11) }),
  ]),
  fixture(
    "PATCH /api/feed/[postId]",
    feedPostEditSchema,
    { body: "Updated post", visibility: "members" },
    [
      hostile("missing-required-field", { visibility: "members" }),
      hostile("empty-string", { body: "", visibility: "members" }),
      hostile("excessively-long-value", {
        body: long(5_001),
        visibility: "members",
      }),
      hostile("invalid-enumeration", {
        body: "Updated post",
        visibility: "worldwide",
      }),
    ],
  ),
  fixture(
    "POST /api/feed/[postId]/comments",
    feedCommentWriteSchema,
    { body: "Good race" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { body: "" }),
      hostile("excessively-long-value", { body: long(2_001) }),
    ],
  ),
  fixture(
    "POST /api/feed/[postId]/reaction",
    feedReactionWriteSchema,
    { reactionType: "like" },
    [
      hostile("empty-string", { reactionType: "" }),
      hostile("excessively-long-value", { reactionType: long(20) }),
      hostile("invalid-enumeration", { reactionType: "angry" }),
    ],
  ),
  fixture("POST /api/feed/[postId]/save", feedActorSelectionSchema, {}, [
    hostile("empty-string", { actorId: "" }),
    hostile("excessively-long-value", { actorId: long(121) }),
  ]),
  fixture(
    "POST /api/feed/[postId]/share",
    feedShareWriteSchema,
    { visibility: "members" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { visibility: "" }),
      hostile("excessively-long-value", {
        body: long(2_001),
        visibility: "members",
      }),
      hostile("invalid-enumeration", { visibility: "worldwide" }),
    ],
  ),
  fixture(
    "PATCH /api/feed/comments/[commentId]",
    feedCommentEditSchema,
    { body: "Updated comment" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { body: "" }),
      hostile("excessively-long-value", { body: long(2_001) }),
    ],
  ),
  fixture(
    "POST /api/feed/comments/[commentId]/reaction",
    feedReactionWriteSchema,
    { reactionType: "support" },
    [
      hostile("empty-string", { reactionType: "" }),
      hostile("excessively-long-value", { reactionType: long(20) }),
      hostile("invalid-enumeration", { reactionType: "angry" }),
    ],
  ),
  fixture(
    "POST /api/feed/topics/[topicId]/follow",
    feedActorSelectionSchema,
    {},
    [
      hostile("empty-string", { actorId: "" }),
      hostile("excessively-long-value", { actorId: long(121) }),
    ],
  ),
  fixture(
    "POST /api/forum/categories/[slug]/threads",
    forumThreadCreateSchema,
    { title: "Race discussion", body: "Detailed race discussion" },
    [
      hostile("missing-required-field", { body: "Detailed race discussion" }),
      hostile("empty-string", { title: "", body: "Detailed race discussion" }),
      hostile("excessively-long-value", {
        title: long(201),
        body: "Detailed race discussion",
      }),
    ],
  ),
  fixture(
    "POST /api/forum/threads/[id]/posts",
    forumPostCreateSchema,
    { body: "Detailed forum response" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { body: "" }),
      hostile("excessively-long-value", { body: long(20_001) }),
    ],
  ),
  fixture(
    "POST /api/listings",
    listingWriteSchema,
    {
      type: "dog_for_sale",
      title: "Racing greyhound",
      description: "Detailed racing greyhound listing",
    },
    [
      hostile("missing-required-field", {
        title: "Racing greyhound",
        description: "Detailed racing greyhound listing",
      }),
      hostile("empty-string", {
        type: "dog_for_sale",
        title: "",
        description: "Detailed racing greyhound listing",
      }),
      hostile("excessively-long-value", {
        type: "dog_for_sale",
        title: long(101),
        description: "Detailed racing greyhound listing",
      }),
      hostile("out-of-range-number", {
        type: "dog_for_sale",
        title: "Racing greyhound",
        description: "Detailed racing greyhound listing",
        price: -1,
      }),
      hostile("invalid-enumeration", {
        type: "contraband",
        title: "Racing greyhound",
        description: "Detailed racing greyhound listing",
      }),
      hostile("invalid-nested-object", {
        type: "dog_for_sale",
        title: "Racing greyhound",
        description: "Detailed racing greyhound listing",
        attributes: [{ key: "weight", value: null }],
      }),
      hostile("oversized-array", {
        type: "dog_for_sale",
        title: "Racing greyhound",
        description: "Detailed racing greyhound listing",
        mediaIds: ids(12),
      }),
    ],
  ),
  fixture(
    "PATCH /api/listings/[id]",
    listingPatchSchema,
    { title: "Updated greyhound" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { title: "" }),
      hostile("excessively-long-value", { title: long(101) }),
      hostile("out-of-range-number", { price: -1 }),
      hostile("invalid-enumeration", { contactPreference: "carrier-pigeon" }),
      hostile("invalid-nested-object", {
        attributes: [{ key: "weight", value: null }],
      }),
      hostile("oversized-array", { mediaIds: ids(12) }),
    ],
  ),
  fixture(
    "POST /api/listings/[id]/enquiry",
    listingEnquirySchema,
    { message: "Is this listing available?" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { message: "" }),
      hostile("excessively-long-value", { message: long(2_001) }),
    ],
  ),
  fixture(
    "POST /api/memory",
    memoryCreateSchema,
    { content: "User prefers race seven" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { content: "" }),
      hostile("excessively-long-value", { content: long(2_001) }),
      hostile("out-of-range-number", {
        content: "User prefers race seven",
        importance: 0,
      }),
      hostile("invalid-enumeration", {
        content: "User prefers race seven",
        kind: "secret",
      }),
    ],
  ),
  fixture(
    "POST /api/memory/[id]/supersede",
    memorySupersedeSchema,
    { replacementContent: "Updated preference" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { replacementContent: "" }),
      hostile("excessively-long-value", { replacementContent: long(2_001) }),
    ],
  ),
  fixture(
    "POST /api/messages",
    legacyConversationMessageSchema,
    { body: "Race update", recipientProfileId: "profile_1" },
    [
      hostile("missing-required-field", { body: "Race update" }),
      hostile("empty-string", { body: "", recipientProfileId: "profile_1" }),
      hostile("excessively-long-value", {
        body: "Race update",
        recipientProfileId: long(121),
      }),
      hostile("oversized-array", {
        body: "Race update",
        recipientProfileId: "profile_1",
        mediaIds: ids(5),
      }),
    ],
  ),
  fixture(
    "PATCH /api/media/[id]",
    mediaMetadataUpdateSchema,
    { altText: "Greyhound at the boxes" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { altText: "" }, "accept"),
      hostile("excessively-long-value", { altText: long(501) }),
    ],
  ),
  fixture(
    "POST /api/media/[id]/finalize",
    mediaFinalizeSchema,
    { sha256: "a".repeat(64) },
    [
      hostile("empty-string", { sha256: "" }),
      hostile("excessively-long-value", { sha256: "a".repeat(65) }),
      hostile("out-of-range-number", { widthPx: 20_001 }),
    ],
  ),
  fixture(
    "POST /api/media/sign-upload",
    mediaSignUploadSchema,
    { filename: "race.jpg", mimeType: "image/jpeg", sizeBytes: 1 },
    [
      hostile("missing-required-field", {
        mimeType: "image/jpeg",
        sizeBytes: 1,
      }),
      hostile("empty-string", {
        filename: "",
        mimeType: "image/jpeg",
        sizeBytes: 1,
      }),
      hostile("excessively-long-value", {
        filename: `${"a".repeat(157)}.jpg`,
        mimeType: "image/jpeg",
        sizeBytes: 1,
      }),
      hostile("out-of-range-number", {
        filename: "race.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 0,
      }),
      hostile("invalid-enumeration", {
        filename: "race.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 1,
      }),
    ],
  ),
  fixture(
    "POST /api/reports",
    reportCreateSchema,
    { targetType: "post", targetId: "post_1", reason: "spam" },
    [
      hostile("missing-required-field", {
        targetId: "post_1",
        reason: "spam",
      }),
      hostile("empty-string", {
        targetType: "post",
        targetId: "",
        reason: "spam",
      }),
      hostile("excessively-long-value", {
        targetType: "post",
        targetId: long(121),
        reason: "spam",
      }),
      hostile("invalid-enumeration", {
        targetType: "database",
        targetId: "post_1",
        reason: "spam",
      }),
    ],
  ),
  fixture(
    "POST /api/reports/[id]/resolve",
    reportResolveSchema,
    { action: "dismiss" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { action: "" }),
      hostile("excessively-long-value", { action: long(30) }),
      hostile("invalid-enumeration", { action: "silently_destroy" }),
    ],
  ),
  fixture(
    "POST /api/users/me/delete",
    accountDeletionRequestSchema,
    { confirm: "DELETE" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { confirm: "" }),
      hostile("excessively-long-value", { confirm: long(20) }),
      hostile("invalid-enumeration", { confirm: "YES" }),
    ],
  ),
  fixture(
    "POST /api/users/me/marketing-preferences",
    accountMarketingPreferenceSchema,
    { channel: "email", optedIn: true },
    [
      hostile("missing-required-field", { channel: "email" }),
      hostile("empty-string", { channel: "", optedIn: true }),
      hostile("excessively-long-value", {
        channel: long(20),
        optedIn: true,
      }),
      hostile("invalid-enumeration", { channel: "sms", optedIn: true }),
    ],
  ),
  fixture(
    "PATCH /api/users/me/profile",
    profileUpdateSchema,
    { displayName: "Racing Owner" },
    [
      hostile("missing-required-field", {}),
      hostile("empty-string", { displayName: "" }),
      hostile("excessively-long-value", { displayName: long(81) }),
      hostile("invalid-enumeration", {
        displayName: "Racing Owner",
        profileVisibility: "everyone",
      }),
      hostile("invalid-url", {
        displayName: "Racing Owner",
        website: "javascript:alert(1)",
      }),
    ],
  ),
] as const satisfies readonly EndpointValidationFixture[];

export const VERIFIED_ENDPOINT_HOSTILE_CASE_KINDS = [
  "missing-required-field",
  "null",
  "empty-string",
  "excessively-long-value",
  "out-of-range-number",
  "invalid-enumeration",
  "unexpected-fields",
  "invalid-nested-object",
  "oversized-array",
  "invalid-url",
] as const satisfies readonly EndpointHostileCaseKind[];
