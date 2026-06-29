import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { cleanText } from "@/lib/content";
import {
  listConversationsForProfile,
  sendConversationMessage,
  startOrGetConversation,
} from "@/lib/conversation-service";
import { prisma } from "@/lib/db";

const sendMessageSchema = z.object({
  recipientProfileId: z.string().min(1),
  body: z.string().trim().min(1).max(5_000),
  mediaIds: z.array(z.string().trim().min(1)).max(4).optional().default([]),
});

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const conversations = await listConversationsForProfile(current.profileId);
    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: current.profileId },
          { recipientId: current.profileId },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        sender: true,
        recipient: true,
        media: {
          orderBy: { position: "asc" },
          include: { media: true },
        },
      },
    });
    return NextResponse.json({ items: messages, conversations });
  } catch (err) {
    return jsonError(err, "Could not load messages");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const parsed = sendMessageSchema.parse(await request.json());
    if (parsed.recipientProfileId === current.profileId) {
      throw new Error("message.cannot_send_to_self");
    }

    const conversation = await startOrGetConversation(
      current,
      parsed.recipientProfileId
    );
    const message = await sendConversationMessage(current, conversation.id, {
      body: cleanText(parsed.body),
      mediaIds: parsed.mediaIds,
    });

    return NextResponse.json({ item: message }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not send message");
  }
}
