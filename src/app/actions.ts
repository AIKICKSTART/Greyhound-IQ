"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  dogOwnershipClaimSchema,
  profileUpdateSchema,
} from "@/lib/account-validation";
import { requestAccountDeletion as requestAccountDeletionForUser } from "@/lib/account-service";
import {
  agentRunSchema as agentRequestSchema,
  normalizeAgentType,
  runAgentForCurrentUser,
} from "@/lib/agent-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { cleanText } from "@/lib/content";
import {
  sendConversationMessage,
  markConversationRead,
  setConversationBlock,
  softDeleteConversationMessage,
  startOrGetConversation,
} from "@/lib/conversation-service";
import { prisma } from "@/lib/db";
import {
  createListingForCurrentUser,
  markListingSoldForCurrentUser,
  renewListingForCurrentUser,
  withdrawListingForCurrentUser,
} from "@/lib/listing-service";
import { checkRateLimit } from "@/lib/rate-limit";

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
  title: z.string().trim().min(5).max(100),
  description: z.string().trim().min(20).max(5_000),
  state: z.string().trim().max(8).optional(),
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
  mediaIds: z.array(z.string().trim().min(1)).max(11).default([]),
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

export async function createForumThread(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = forumThreadSchema.parse({
    categoryId: field(formData, "categoryId"),
    title: field(formData, "title"),
    body: field(formData, "body"),
  });

  const category = await prisma.forumCategory.findUnique({
    where: { id: parsed.categoryId },
  });
  if (!category) throw new Error("forum.category_not_found");

  const thread = await prisma.$transaction(async (tx) => {
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

  revalidatePath("/forum");
  revalidatePath(`/forum/${category.slug}`);
  redirect(`/forum/threads/${thread.id}`);
}

export async function replyToForumThread(threadId: string, formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = forumReplySchema.parse({ body: field(formData, "body") });

  const thread = await prisma.thread.findUnique({
    where: { id: threadId },
    include: { category: true },
  });
  if (!thread || thread.locked) throw new Error("forum.thread_unavailable");

  await prisma.$transaction([
    prisma.post.create({
      data: {
        threadId: thread.id,
        authorId: current.profileId,
        body: cleanText(parsed.body),
      },
    }),
    prisma.thread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() },
    }),
  ]);

  revalidatePath("/forum");
  revalidatePath(`/forum/${thread.category.slug}`);
  revalidatePath(`/forum/threads/${thread.id}`);
  redirect(`/forum/threads/${thread.id}`);
}

export async function createListing(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const parsed = listingSchema.parse({
    type: field(formData, "type"),
    title: field(formData, "title"),
    description: field(formData, "description"),
    state: field(formData, "state") || undefined,
    dogId: field(formData, "dogId") || undefined,
    price: field(formData, "price") || undefined,
    mediaIds: fields(formData, "mediaIds"),
  });

  const dogId = parsed.dogId || null;
  if (dogId) {
    const dog = await prisma.dog.findUnique({ where: { id: dogId } });
    if (!dog) throw new Error("listing.dog_not_found");
  }

  await createListingForCurrentUser(current, {
    type: parsed.type,
    title: cleanText(parsed.title),
    description: cleanText(parsed.description),
    state: parsed.state || null,
    dogId,
    price: parsed.price,
    mediaIds: parsed.mediaIds,
  });

  revalidatePath("/listings");
  redirect("/listings");
}

export async function renewListing(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await renewListingForCurrentUser(current, listingId);

  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  redirect(`/listings/${listingId}`);
}

export async function markListingSold(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await markListingSoldForCurrentUser(current, listingId);

  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  redirect(`/listings/${listingId}`);
}

export async function withdrawListing(listingId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await withdrawListingForCurrentUser(current, listingId);

  revalidatePath("/listings");
  revalidatePath(`/listings/${listingId}`);
  redirect(`/listings/${listingId}`);
}

export async function sendMessage(formData: FormData) {
  const current = await requireCurrentUserProfile();
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

  revalidatePath("/messages");
  redirect(`/messages/${conversation.id}`);
}

export async function replyToConversation(
  conversationId: string,
  formData: FormData
) {
  const current = await requireCurrentUserProfile();
  const parsed = messageReplySchema.parse({
    body: field(formData, "body"),
    mediaIds: fields(formData, "mediaIds"),
  });

  await sendConversationMessage(current, conversationId, {
    body: cleanText(parsed.body),
    mediaIds: parsed.mediaIds,
  });

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect(`/messages/${conversationId}`);
}

export async function deleteConversationMessage(
  conversationId: string,
  messageId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await softDeleteConversationMessage(current, conversationId, messageId);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect(`/messages/${conversationId}`);
}

export async function markConversationReadAction(
  conversationId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await markConversationRead(current, conversationId);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect(`/messages/${conversationId}`);
}

export async function blockConversation(conversationId: string, _formData?: FormData) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await setConversationBlock(current, conversationId, true);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect(`/messages/${conversationId}`);
}

export async function unblockConversation(
  conversationId: string,
  _formData?: FormData
) {
  void _formData;
  const current = await requireCurrentUserProfile();
  await setConversationBlock(current, conversationId, false);

  revalidatePath("/messages");
  revalidatePath(`/messages/${conversationId}`);
  redirect(`/messages/${conversationId}`);
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
  const rateLimit = checkRateLimit(
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

  await prisma.profile.update({
    where: { id: current.profileId },
    data: parsed,
  });

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
