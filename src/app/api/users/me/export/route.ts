import { NextResponse } from "next/server";
import { recordUserExportCompletion } from "@/lib/account-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import {
  emergencyControlResponse,
  isEmergencyControlActive,
} from "@/lib/emergency-controls";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import {
  assertUserExportDto,
  assertUserExportSize,
  USER_EXPORT_CACHE_CONTROL,
} from "@/lib/user-export-policy";
import { readUserExportData } from "@/lib/user-export-service";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const USER_EXPORT_RATE_LIMIT = 3;
const USER_EXPORT_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const PRIVATE_NO_STORE = { "cache-control": USER_EXPORT_CACHE_CONTROL } as const;

export async function POST(request: Request) {
  if (isEmergencyControlActive(process.env.EXPORT_DISABLED)) {
    return emergencyControlResponse();
  }

  try {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      return privateJson(
        { error: { code: "auth.forbidden", message: "Cross-site request blocked" } },
        403
      );
    }

    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `user-export:${current.dbUserId}`,
      USER_EXPORT_RATE_LIMIT,
      USER_EXPORT_RATE_LIMIT_WINDOW_MS,
      { failClosed: true }
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        USER_EXPORT_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const {
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
      agentRuns,
    } = await readUserExportData(current);
    const exportedAt = new Date();
    const archive = {
      schemaVersion: "greyhoundiq-user-export/v2" as const,
      exportedAt: exportedAt.toISOString(),
      user,
      profile,
      community: { threads, posts, listings },
      messages: {
        conversations,
        sent: messagesSent,
        received: messagesReceived,
      },
      mediaAssets,
      memoryEntries,
      agentRuns,
    };
    assertUserExportDto(archive);

    const responseBody = JSON.stringify(archive, null, 2);
    const sizeBytes = assertUserExportSize(responseBody);

    await recordUserExportCompletion(current, {
      exportedAt,
      sizeBytes,
      schemaVersion: archive.schemaVersion,
      ip: getClientIp(request.headers),
      userAgent: request.headers.get("user-agent"),
      counts: {
        threads: threads.length,
        posts: posts.length,
        listings: listings.length,
        conversations: conversations.length,
        messagesSent: messagesSent.length,
        messagesReceived: messagesReceived.length,
        mediaAssets: mediaAssets.length,
        memoryEntries: memoryEntries.length,
        agentRuns: agentRuns.length,
      },
    });

    const date = exportedAt.toISOString().slice(0, 10);
    return new NextResponse(responseBody, {
      headers: {
        ...PRIVATE_NO_STORE,
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="greyhoundiq-export-${date}.json"`,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message === "export.too_large") {
      return privateJson(
        {
          error: {
            code: "export.too_large",
            message:
              "This account export is too large for an immediate download. Contact support for a managed export.",
          },
        },
        413
      );
    }
    const response =
      err instanceof Error && err.message === "export.forbidden_field"
        ? await jsonError(
            new Error("User export contract violation"),
            "Could not export account data",
          )
        : await jsonError(err, "Could not export account data");
    response.headers.set("cache-control", PRIVATE_NO_STORE["cache-control"]);
    return response;
  }
}

function privateJson(body: unknown, status: number) {
  return NextResponse.json(body, { status, headers: PRIVATE_NO_STORE });
}
