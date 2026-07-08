import { NextResponse } from "next/server";
import { createAuditLog } from "@/lib/account-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { withDbRequestContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

const USER_EXPORT_RATE_LIMIT = 3;
const USER_EXPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const USER_EXPORT_ARTIFACT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  try {
    // This GET mutates (creates an export artifact + audit log), so a cross-site
    // top-level navigation must not trigger it. Sec-Fetch-Site is browser-set and
    // unspoofable; the legit same-origin download link sends "same-origin".
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return NextResponse.json(
        { error: { code: "auth.forbidden", message: "Cross-site request blocked" } },
        { status: 403 }
      );
    }
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `user-export:${current.dbUserId}`,
      USER_EXPORT_RATE_LIMIT,
      USER_EXPORT_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "rate_limit.exceeded",
            message: "Too many requests",
          },
        },
        { status: 429 }
      );
    }

    const [
      user,
      profile,
      threads,
      posts,
      listings,
      conversations,
      messagesSent,
      messagesReceived,
      mediaAssets,
      memoryEntries,
      agentContexts,
      agentRuns,
    ] = await withDbRequestContext(current, (tx) => Promise.all([
      tx.user.findUnique({
        where: { id: current.dbUserId },
        select: {
          id: true,
          email: true,
          name: true,
          subscriptionTier: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          isBanned: true,
          deletionRequestedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      tx.profile.findUnique({
        where: { id: current.profileId },
        include: {
          dogsOwned: {
            orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
            include: {
              dog: {
                select: {
                  id: true,
                  name: true,
                  earBrand: true,
                  colour: true,
                  sex: true,
                  whelpDate: true,
                },
              },
            },
          },
        },
      }),
      tx.thread.findMany({
        where: { authorId: current.profileId },
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { posts: true } } },
      }),
      tx.post.findMany({
        where: { authorId: current.profileId },
        orderBy: { createdAt: "desc" },
        include: {
          thread: {
            select: {
              id: true,
              title: true,
              category: true,
            },
          },
        },
      }),
      tx.listing.findMany({
        where: { profileId: current.profileId },
        orderBy: { createdAt: "desc" },
        include: {
          dog: {
            select: {
              id: true,
              name: true,
              earBrand: true,
            },
          },
          media: {
            orderBy: { position: "asc" },
            include: { media: true },
          },
        },
      }),
      tx.conversation.findMany({
        where: {
          OR: [
            { participantAId: current.profileId },
            { participantBId: current.profileId },
          ],
        },
        orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
        include: {
          participantA: true,
          participantB: true,
        },
      }),
      tx.message.findMany({
        where: { senderId: current.profileId },
        orderBy: { createdAt: "desc" },
        include: {
          recipient: {
            select: {
              id: true,
              displayName: true,
            },
          },
          media: {
            orderBy: { position: "asc" },
            include: { media: true },
          },
        },
      }),
      tx.message.findMany({
        where: { recipientId: current.profileId },
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
            },
          },
          media: {
            orderBy: { position: "asc" },
            include: { media: true },
          },
        },
      }),
      tx.mediaAsset.findMany({
        where: { uploaderId: current.dbUserId },
        orderBy: { createdAt: "desc" },
        include: {
          messageAttachments: true,
          listingAttachments: true,
        },
      }),
      tx.memoryEntry.findMany({
        where: { userId: current.dbUserId },
        orderBy: { createdAt: "desc" },
      }),
      tx.conversationContext.findMany({
        where: { userId: current.dbUserId },
        orderBy: { updatedAt: "desc" },
      }),
      tx.agentRun.findMany({
        where: { userId: current.dbUserId },
        orderBy: { createdAt: "desc" },
      }),
    ]));

    await createAuditLog({
      actorId: current.dbUserId,
      actorType: "user",
      action: "user.export",
      targetType: "user",
      targetId: current.dbUserId,
      ip: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        format: "json",
        sections: [
          "user",
          "profile",
          "threads",
          "posts",
          "listings",
          "conversations",
          "messages",
          "mediaAssets",
          "memoryEntries",
          "agentContexts",
          "agentRuns",
        ],
      },
    });

    const exportedAt = new Date();
    const archive = {
      schemaVersion: "greyhoundiq-user-export/v1",
      exportedAt,
      user,
      profile,
      community: {
        threads,
        posts,
        listings,
      },
      messages: {
        conversations,
        sent: messagesSent,
        received: messagesReceived,
      },
      mediaAssets,
      memoryEntries,
      agentContexts,
      agentRuns,
    };

    const responseBody = JSON.stringify(archive, null, 2);
    const sizeBytes = new TextEncoder().encode(responseBody).byteLength;

    await withDbRequestContext(current, (tx) =>
      tx.exportArtifact.create({
        data: {
          exportType: "user_data",
          status: "completed",
          targetUserId: current.dbUserId,
          requestedByUserId: current.dbUserId,
          sizeBytes,
          completedAt: exportedAt,
          expiresAt: new Date(exportedAt.getTime() + USER_EXPORT_ARTIFACT_TTL_MS),
        },
      })
    );

    const date = exportedAt.toISOString().slice(0, 10);
    return new NextResponse(responseBody, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="greyhoundiq-export-${date}.json"`,
      },
    });
  } catch (err) {
    return jsonError(err, "Could not export account data");
  }
}
