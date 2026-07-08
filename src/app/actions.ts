"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  dogOwnershipClaimSchema,
  hasProfileMarketingFields,
  profileUpdateSchema,
} from "@/lib/account-validation";
import { requestAccountDeletion as requestAccountDeletionForUser } from "@/lib/account-service";
import {
  agentRunSchema as agentRequestSchema,
  normalizeAgentType,
  runAgentForCurrentUser,
} from "@/lib/agent-service";
import {
  assertPaidFeatureAccess,
  hasTier,
  requireCurrentUserProfile,
  requireModeratorProfile,
} from "@/lib/auth";
import { cleanText } from "@/lib/content";
import {
  sendConversationMessage,
  markConversationRead,
  setConversationBlock,
  softDeleteConversationMessage,
  startOrGetConversation,
  toggleConversationMessageReaction as toggleConversationMessageReactionForCurrentUser,
} from "@/lib/conversation-service";
import { prisma } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";
import {
  blockFeedPostAuthorForCurrentUser,
  createFeedTopicForModerator,
  createFeedCommentForCurrentUser,
  createFeedPostForCurrentUser,
  moderateFeedPostForModerator,
  setFeedTopicActiveForModerator,
  toggleFeedPostReactionForCurrentUser,
} from "@/lib/feed-service";
import {
  feedPostModerationSchema,
  feedCommentWriteSchema,
  feedPostWriteSchema,
  feedReportSchema,
  feedTopicWriteSchema,
} from "@/lib/feed-validation";
import {
  approveListingForModerator,
  createMarketplaceCategoryForModerator,
  createListingEnquiryForCurrentUser,
  createListingForCurrentUser,
  markListingSoldForCurrentUser,
  rejectListingForModerator,
  removeListingForModerator,
  renewListingForCurrentUser,
  setMarketplaceCategoryActiveForModerator,
  toggleSavedListingForCurrentUser,
  withdrawListingForCurrentUser,
} from "@/lib/listing-service";
import { listingEnquirySchema } from "@/lib/listing-validation";
import {
  createBannedPhraseForModerator,
  resolveTrustSafetyFlagForModerator,
  setBannedPhraseActiveForModerator,
} from "@/lib/moderation-service";
import {
  markAllNotificationsReadForCurrentUser,
  markNotificationReadForCurrentUser,
} from "@/lib/notification-service";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  createReportForUser,
  resolveReportForModerator,
} from "@/lib/report-service";
import { reportCreateSchema, reportResolveSchema } from "@/lib/report-validation";

const forumThreadSchema = z.object({
  categoryId: z.string().min(1),
  title: z.string().trim().min(5).max(200),
  body: z.string().trim().min(20).max(20_000),
});

const forumReplySchema = z.object({
  body: z.string().trim().min(20).max(20_000),
});

const listingSchema = z.object({
  type: z.enum(["pup_for_sale", "dog_for_sale", "stud_service", "wanted", "share"]),
  categoryId: z.string().trim().optional(),
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(20).max(5_000),
  state: z.string().trim().max(8).optional(),
  region: z.string().trim().max(120).optional(),
  suburb: z.string().trim().max(120).optional(),
  postcode: z.string().trim().max(16).optional(),
  condition: z.string().trim().max(80).optional(),
  negotiable: z.boolean().default(false),
  contactPreference: z.enum(["message", "email", "phone"]).default("message"),
  dogId: z.string().trim().optional(),
  price: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 ? parsed : Number.NaN;
    })
    .refine((value) => value === null || Number.isFinite(value), {
      message: "Price must be a positive number",
    }),
  welfareAcknowledged: z.boolean().default(false),
  legalAcknowledged: z.boolean().default(false),
  mediaIds: z.array(z.string().trim().min(1)).max(11).default([]),
  attributes: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(40).transform(cleanText),
        value: z.string().trim().min(1).max(120).transform(cleanText),
      })
    )
    .max(8)
    .default([]),
});

const listingReportSchema = z.object({
  reason: z.enum(["spam", "harassment", "misinformation", "illegal", "other"]),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => {
      const cleaned = cleanText(value ?? "");
      return cleaned.length > 0 ? cleaned : null;
    }),
});

const marketplaceCategoryWriteSchema = z.object({
  name: z.string().trim().min(2).max(80).transform(cleanText),
  slug: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => cleanText(value ?? "") || null),
  description: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => cleanText(value ?? "") || null),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

const bannedPhraseWriteSchema = z.object({
  phrase: z.string().trim().min(2).max(120).transform(cleanText),
  target: z.enum(["all", "listing", "feed", "message"]).default("all"),
  action: z.enum(["review", "block"]).default("review"),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((value) => cleanText(value ?? "") || null),
});

const messageSchema = z.object({
  recipientProfileId: z.string().min(1),
  body: z.string().trim().min(1).max(5_000),
  mediaIds: z.array(z.string().trim().min(1)).max(4).default([]),
});

const messageReplySchema = messageSchema.pick({
  body: true,
  mediaIds: true,
});

const agentFormSchema = z.object({
  agentType: z.string().trim().min(1),
  input: agentRequestSchema.shape.input,
});

const supportTicketSchema = z.object({
  category: z.enum(["general", "billing", "technical", "feedback"]),
  body: z.string().trim().min(20).max(5_000),
});

const SUPPORT_TICKET_RATE_LIMIT = 3;
const SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const FEED_POST_RATE_LIMIT = 5;
const FEED_POST_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const FEED_COMMENT_RATE_LIMIT = 20;
const FEED_COMMENT_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const FEED_REACTION_RATE_LIMIT = 60;
const FEED_REACTION_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const FEED_BLOCK_RATE_LIMIT = 20;
const FEED_BLOCK_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MESSAGE_SEND_RATE_LIMIT = 10;
const MESSAGE_SEND_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MESSAGE_REACTION_RATE_LIMIT = 30;
const MESSAGE_REACTION_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MESSAGE_REPORT_RATE_LIMIT = 10;
const MESSAGE_REPORT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const LISTING_ENQUIRY_RATE_LIMIT = 5;
const LISTING_ENQUIRY_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LISTING_REPORT_RATE_LIMIT = 10;
const LISTING_REPORT_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const LISTING_SAVE_RATE_LIMIT = 30;
const LISTING_SAVE_RATE_LIMIT_WINDOW_MS = 60 * 1000;
const REPORT_RESOLVE_RATE_LIMIT = 30;
const REPORT_RESOLVE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function fields(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === "string")
    .filter(Boolean);
}

function listingAttributes(formData: FormData) {
  const keys = formData.getAll("attributeKey");
  const values = formData.getAll("attributeValue");
  return keys
    .map((rawKey, index) => ({
      key: typeof rawKey === "string" ? rawKey : "",
      value: typeof values[index] === "string" ? values[index] : "",
    }))
    .filter((attribute) => attribute.key.trim() && attribute.value.trim());
}

function moderationReason(formData: FormData, fallback: string) {
  const reason = cleanText(field(formData, "reason").trim());
  return reason || fallback;
}

export async function createForumThread(formData: FormData) {
  const current = await requireCurrentUserProfile();
  assertPaidFeatureAccess(current);
  const parsed = forumThreadSchema.parse({
    categoryId: field(formData, "categoryId"),
    title: field(formData, "title"),
    body: field(formData, "body"),
  });

  const category = await prisma.forumCategory.findUnique({
    where: { id: parsed.categoryId },
  });
  if (!category) throw new Error("forum.category_not_found");

  const thread = await withDbRequestContext(current, async (tx) => {
    const created = await tx.thread.create({
      data: {
        categoryId: category.id,
        title: cleanText(parsed.title),
        authorId: current.profileId,
      },
    });
    await tx.post.create({
      data: {
        threadId: created.id,
        authorId: current.profileId,
        body: cleanText(parsed.body),
      },
    });
    return created;
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${category.slug}`);
  redirect(`/groups/threads/${thread.id}`);
}

export async function replyToForumThread(threadId: string, formData: FormData) {
  const current = await requireCurrentUserProfile();
  assertPaidFeatureAccess(current);
  const parsed = forumReplySchema.parse({ body: field(formData, "body") });

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { category: true },
  });
  if (!thread || thread.locked) throw new Error("forum.thread_unavailable");

  await withDbRequestContext(current, async (tx) => {
    await tx.post.create({
      data: {
        threadId: thread.id,
        authorId: current.profileId,
        body: cleanText(parsed.body),
      },
    });
    await tx.thread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    });
  });

  revalidatePath("/groups");
  revalidatePath(`/groups/${thread.category.slug}`);
  revalidatePath(`/groups/threads/${thread.id}`);
  redirect(`/groups/threads/${thread.id}`);
}

export async function createFeedPost(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `feed:post:${current.dbUserId}`,
    FEED_POST_RATE_LIMIT,
    FEED_POST_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = feedPostWriteSchema.parse({
    topicId: field(formData, "topicId") || null,
    body: field(formData, "body"),
    mediaIds: fields(formData, "mediaIds"),
  });

  await createFeedPostForCurrentUser(current, parsed);
  revalidatePath("/feed");
  redirect("/feed");
}

export async function replyToFeedPost(postId: string, formData: FormData) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `feed:comment:${current.dbUserId}:${postId}`,
    FEED_COMMENT_RATE_LIMIT,
    FEED_COMMENT_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = feedCommentWriteSchema.parse({
    body: field(formData, "body"),
    parentCommentId: field(formData, "parentCommentId") || null,
  });

  await createFeedCommentForCurrentUser(current, postId, parsed);
  revalidatePath("/feed");
  redirect("/feed");
}

export async function toggleFeedPostReaction(
  postId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `feed:reaction:${current.dbUserId}:${postId}`,
    FEED_REACTION_RATE_LIMIT,
    FEED_REACTION_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  await toggleFeedPostReactionForCurrentUser(current, postId);
  revalidatePath("/feed");
  redirect("/feed");
}

export async function reportFeedPost(postId: string, formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = feedReportSchema.parse({
    reason: field(formData, "reason") || "other",
    description: field(formData, "description") || null,
  });

  await createReportForUser(current, {
    targetType: "feed_post",
    targetId: postId,
    reason: parsed.reason,
    description: parsed.description,
  });
  revalidatePath("/feed");
  redirect("/feed");
}

export async function blockFeedPostAuthor(postId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `feed:block:${current.dbUserId}:${postId}`,
    FEED_BLOCK_RATE_LIMIT,
    FEED_BLOCK_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  await blockFeedPostAuthorForCurrentUser(current, postId);
  revalidatePath("/feed");
  redirect("/feed");
}

export async function createFeedTopic(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = feedTopicWriteSchema.parse({
    name: field(formData, "name"),
    slug: field(formData, "slug") || undefined,
    rules: field(formData, "rules") || undefined,
    sortOrder: field(formData, "sortOrder") || 0,
  });

  await createFeedTopicForModerator(current, parsed);
  revalidatePath("/admin");
  revalidatePath("/admin/feed");
  revalidatePath("/feed");
  redirect("/admin/feed");
}

export async function setFeedTopicActive(
  topicId: string,
  active: boolean,
  _formData?: FormData
) {
  void _formData;
  const current = await requireModeratorProfile();
  await setFeedTopicActiveForModerator(current, topicId, active);
  revalidatePath("/admin/feed");
  revalidatePath("/feed");
  redirect("/admin/feed");
}

export async function moderateFeedPost(postId: string, formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = feedPostModerationSchema.parse({
    action: field(formData, "action"),
    reason: field(formData, "reason") || undefined,
  });

  await moderateFeedPostForModerator(current, postId, parsed);
  revalidatePath("/admin/feed");
  revalidatePath("/feed");
  redirect("/admin/feed");
}

export async function createListing(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = listingSchema.parse({
    type: field(formData, "type"),
    categoryId: field(formData, "categoryId") || undefined,
    title: field(formData, "title"),
    description: field(formData, "description"),
    state: field(formData, "state") || undefined,
    region: field(formData, "region") || undefined,
    suburb: field(formData, "suburb") || undefined,
    postcode: field(formData, "postcode") || undefined,
    condition: field(formData, "condition") || undefined,
    negotiable: field(formData, "negotiable") === "true",
    contactPreference: field(formData, "contactPreference") || "message",
    dogId: field(formData, "dogId") || undefined,
    price: field(formData, "price") || undefined,
    welfareAcknowledged: field(formData, "welfareAcknowledged") === "true",
    legalAcknowledged: field(formData, "legalAcknowledged") === "true",
    mediaIds: fields(formData, "mediaIds"),
    attributes: listingAttributes(formData),
  });

  const dogId = parsed.dogId || null;
  if (dogId) {
    const dog = await prisma.dog.findUnique({ where: { id: dogId } });
    if (!dog) throw new Error("listing.dog_not_found");
  }

  await createListingForCurrentUser(current, {
    type: parsed.type,
    categoryId: parsed.categoryId || null,
    title: cleanText(parsed.title),
    description: cleanText(parsed.description),
    state: parsed.state || null,
    region: parsed.region || null,
    suburb: parsed.suburb || null,
    postcode: parsed.postcode || null,
    condition: parsed.condition || null,
    negotiable: parsed.negotiable,
    contactPreference: parsed.contactPreference,
    dogId,
    price: parsed.price,
    welfareAcknowledged: parsed.welfareAcknowledged,
    legalAcknowledged: parsed.legalAcknowledged,
    mediaIds: parsed.mediaIds,
    attributes: parsed.attributes,
  });

  revalidatePath("/marketplace");
  redirect("/marketplace?submitted=review");
}

export async function enquireAboutListing(
  listingId: string,
  formData: FormData
) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `listing:enquiry:${current.dbUserId}:${listingId}`,
    LISTING_ENQUIRY_RATE_LIMIT,
    LISTING_ENQUIRY_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = listingEnquirySchema.parse({
    message: field(formData, "message"),
  });
  const result = await createListingEnquiryForCurrentUser(
    current,
    listingId,
    parsed.message
  );

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${result.conversationId}`);
  revalidatePath(`/marketplace/${listingId}`);
  redirect(`/pulse/${result.conversationId}`);
}

export async function reportListing(listingId: string, formData: FormData) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `listing:report:${current.dbUserId}:${listingId}`,
    LISTING_REPORT_RATE_LIMIT,
    LISTING_REPORT_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = listingReportSchema.parse({
    reason: field(formData, "reason") || "other",
    description: field(formData, "description") || undefined,
  });
  await createReportForUser(current, {
    targetType: "listing",
    targetId: listingId,
    reason: parsed.reason,
    description: parsed.description,
  });

  revalidatePath("/admin/reports");
  revalidatePath("/admin/listings");
  revalidatePath(`/marketplace/${listingId}`);
  redirect(`/marketplace/${listingId}`);
}

export async function toggleSavedListing(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `listing:save:${current.dbUserId}:${listingId}`,
    LISTING_SAVE_RATE_LIMIT,
    LISTING_SAVE_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  await toggleSavedListingForCurrentUser(current, listingId);

  revalidatePath("/account");
  revalidatePath("/account/saved-listings");
  revalidatePath(`/marketplace/${listingId}`);
  redirect(`/marketplace/${listingId}`);
}

export async function renewListing(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await renewListingForCurrentUser(current, listingId);

  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/${listingId}`);
  redirect(`/marketplace/${listingId}`);
}

export async function markListingSold(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await markListingSoldForCurrentUser(current, listingId);

  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/${listingId}`);
  redirect(`/marketplace/${listingId}`);
}

export async function withdrawListing(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await withdrawListingForCurrentUser(current, listingId);

  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/${listingId}`);
  redirect(`/marketplace/${listingId}`);
}

export async function approveListing(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireModeratorProfile();
  await approveListingForModerator(current, listingId);

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/${listingId}`);
  redirect("/admin/listings");
}

export async function rejectListing(listingId: string, formData: FormData) {
  const current = await requireModeratorProfile();
  await rejectListingForModerator(
    current,
    listingId,
    moderationReason(formData, "Rejected marketplace item")
  );

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath(`/marketplace/${listingId}`);
  redirect("/admin/listings");
}

export async function removeListing(listingId: string, formData: FormData) {
  const current = await requireModeratorProfile();
  await removeListingForModerator(
    current,
    listingId,
    moderationReason(formData, "Removed marketplace item")
  );

  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/marketplace");
  revalidatePath(`/marketplace/${listingId}`);
  redirect("/admin/listings");
}

export async function createMarketplaceCategory(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = marketplaceCategoryWriteSchema.parse({
    name: field(formData, "name"),
    slug: field(formData, "slug") || undefined,
    description: field(formData, "description") || undefined,
    sortOrder: field(formData, "sortOrder") || 0,
  });

  await createMarketplaceCategoryForModerator(current, parsed);
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/marketplace");
  redirect("/admin/listings");
}

export async function setMarketplaceCategoryActive(
  categoryId: string,
  active: boolean,
  _formData?: FormData
) {
  void _formData;
  const current = await requireModeratorProfile();
  await setMarketplaceCategoryActiveForModerator(current, categoryId, active);
  revalidatePath("/admin");
  revalidatePath("/admin/listings");
  revalidatePath("/marketplace");
  redirect("/admin/listings");
}

export async function resolveReport(reportId: string, formData: FormData) {
  const current = await requireModeratorProfile();
  const rateLimit = await checkRateLimit(
    `report:resolve:${current.dbUserId}`,
    REPORT_RESOLVE_RATE_LIMIT,
    REPORT_RESOLVE_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = reportResolveSchema.parse({
    action: field(formData, "action"),
    notes: field(formData, "notes") || null,
  });

  await resolveReportForModerator(current, reportId, parsed);

  revalidatePath("/admin");
  revalidatePath("/admin/reports");
  revalidatePath("/admin/listings");
  redirect("/admin/reports");
}

export async function createBannedPhrase(formData: FormData) {
  const current = await requireModeratorProfile();
  const parsed = bannedPhraseWriteSchema.parse({
    phrase: field(formData, "phrase"),
    target: field(formData, "target") || "all",
    action: field(formData, "action") || "review",
    reason: field(formData, "reason") || undefined,
  });

  await createBannedPhraseForModerator(current, parsed);
  revalidatePath("/admin");
  revalidatePath("/admin/safety");
  redirect("/admin/safety");
}

export async function setBannedPhraseActive(
  phraseId: string,
  active: boolean,
  _formData?: FormData
) {
  void _formData;
  const current = await requireModeratorProfile();
  await setBannedPhraseActiveForModerator(current, phraseId, active);
  revalidatePath("/admin/safety");
  redirect("/admin/safety");
}

export async function resolveTrustSafetyFlag(
  flagId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireModeratorProfile();
  await resolveTrustSafetyFlagForModerator(current, flagId);
  revalidatePath("/admin");
  revalidatePath("/admin/safety");
  redirect("/admin/safety");
}

export async function sendMessage(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `message:send:${current.dbUserId}`,
    MESSAGE_SEND_RATE_LIMIT,
    MESSAGE_SEND_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = messageSchema.parse({
    recipientProfileId: field(formData, "recipientProfileId"),
    body: field(formData, "body"),
    mediaIds: fields(formData, "mediaIds"),
  });

  const conversation = await startOrGetConversation(
    current,
    parsed.recipientProfileId
  );
  await sendConversationMessage(current, conversation.id, {
    body: cleanText(parsed.body),
    mediaIds: parsed.mediaIds,
  });

  revalidatePath("/pulse");
  redirect(`/pulse/${conversation.id}`);
}

export async function replyToConversation(
  conversationId: string,
  formData: FormData
) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `message:send:${current.dbUserId}`,
    MESSAGE_SEND_RATE_LIMIT,
    MESSAGE_SEND_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = messageReplySchema.parse({
    body: field(formData, "body"),
    mediaIds: fields(formData, "mediaIds"),
  });

  await sendConversationMessage(current, conversationId, {
    body: cleanText(parsed.body),
    mediaIds: parsed.mediaIds,
  });

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function deleteConversationMessage(
  conversationId: string,
  messageId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await softDeleteConversationMessage(current, conversationId, messageId);

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function markConversationReadAction(
  conversationId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await markConversationRead(current, conversationId);

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function blockConversation(conversationId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await setConversationBlock(current, conversationId, true);

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function unblockConversation(
  conversationId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await setConversationBlock(current, conversationId, false);

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function toggleMessageReaction(
  conversationId: string,
  messageId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `message:reaction:${current.dbUserId}:${messageId}`,
    MESSAGE_REACTION_RATE_LIMIT,
    MESSAGE_REACTION_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  await toggleConversationMessageReactionForCurrentUser(
    current,
    conversationId,
    messageId
  );

  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function reportConversationMessage(
  conversationId: string,
  messageId: string,
  formData: FormData
) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `message:report:${current.dbUserId}:${messageId}`,
    MESSAGE_REPORT_RATE_LIMIT,
    MESSAGE_REPORT_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const message = await prisma.message.findFirst({
    where: {
      id: messageId,
      conversationId,
      OR: [
        { senderId: current.profileId },
        { recipientId: current.profileId },
      ],
    },
    select: { senderId: true },
  });
  if (!message) throw new Error("message.not_found");
  if (message.senderId === current.profileId) {
    throw new Error("message.cannot_report_own");
  }

  const parsed = reportCreateSchema.parse({
    targetType: "message",
    targetId: messageId,
    reason: field(formData, "reason") || "other",
    description: field(formData, "description") || null,
  });
  await createReportForUser(current, parsed);

  revalidatePath("/admin/reports");
  revalidatePath("/pulse");
  revalidatePath(`/pulse/${conversationId}`);
  redirect(`/pulse/${conversationId}`);
}

export async function createAgentRun(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = agentFormSchema.parse({
    agentType: field(formData, "agentType"),
    input: field(formData, "input"),
  });
  const agentType = normalizeAgentType(parsed.agentType);
  if (!agentType) throw new Error("agent.not_found");

  await runAgentForCurrentUser(current, agentType, {
    input: parsed.input,
  });

  revalidatePath("/agents");
  redirect("/agents");
}

export async function createSupportTicket(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `support:${current.dbUserId}`,
    SUPPORT_TICKET_RATE_LIMIT,
    SUPPORT_TICKET_RATE_LIMIT_WINDOW_MS
  );
  if (!rateLimit.allowed) throw new Error("support.rate_limit");

  const parsed = supportTicketSchema.parse({
    category: field(formData, "category"),
    body: field(formData, "body"),
  });

  await prisma.$transaction(async (tx) => {
    const ticket = await tx.supportTicket.create({
      data: {
        userId: current.dbUserId,
        category: parsed.category,
      },
    });

    await tx.supportMessage.create({
      data: {
        ticketId: ticket.id,
        userId: current.dbUserId,
        body: cleanText(parsed.body),
      },
    });
  });

  revalidatePath("/account/support");
  redirect("/account/support?ticket=created");
}

export async function markNotificationRead(
  notificationId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await markNotificationReadForCurrentUser(current, notificationId);

  revalidatePath("/account");
  revalidatePath("/account/notifications");
  redirect("/account/notifications");
}

export async function markAllNotificationsRead(_formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await markAllNotificationsReadForCurrentUser(current);

  revalidatePath("/account");
  revalidatePath("/account/notifications");
  redirect("/account/notifications");
}

export async function updateProfile(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = profileUpdateSchema.parse({
    displayName: field(formData, "displayName"),
    bio: field(formData, "bio"),
    state: field(formData, "state"),
    kennelName: field(formData, "kennelName"),
    kennelPrefix: field(formData, "kennelPrefix"),
    website: field(formData, "website"),
    phone: field(formData, "phone"),
  });
  if (hasProfileMarketingFields(parsed)) assertPaidFeatureAccess(current);
  const data = hasTier(current.tier, "pro")
    ? parsed
    : {
        displayName: parsed.displayName,
        bio: parsed.bio,
        state: parsed.state,
      };

  await withDbRequestContext(current, (tx) => tx.profile.update({
    where: { id: current.profileId },
    data,
  }));

  revalidatePath("/account");
  redirect("/account");
}

export async function claimDogOwnership(dogId: string, formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = dogOwnershipClaimSchema.parse({
    role: field(formData, "role"),
  });

  const dog = await prisma.dog.findUnique({ where: { id: dogId } });
  if (!dog) throw new Error("dog.not_found");

  await prisma.dogOwnership.upsert({
    where: {
      dogId_profileId: {
        dogId: dog.id,
        profileId: current.profileId,
      },
    },
    update: {
      role: parsed.role,
    },
    create: {
      dogId: dog.id,
      profileId: current.profileId,
      role: parsed.role,
      verified: false,
    },
  });

  revalidatePath("/account");
  revalidatePath(`/dogs/${dog.id}`);
  redirect(`/dogs/${dog.id}`);
}

export async function requestAccountDeletion() {
  const current = await requireCurrentUserProfile();
  await requestAccountDeletionForUser(current);

  revalidatePath("/account");
  redirect("/account");
}
