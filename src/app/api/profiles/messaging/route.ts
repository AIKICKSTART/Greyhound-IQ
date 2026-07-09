import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getMessagingProfiles } from "@/lib/queries";

const MESSAGING_PROFILES_RATE_LIMIT = 30;
const MESSAGING_PROFILES_RATE_LIMIT_WINDOW_MS = 60_000;
const MESSAGING_PROFILES_LIMIT = 20;
const MAX_QUERY_LENGTH = 80;

export async function GET(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `profiles:messaging:${current.dbUserId}`,
      MESSAGING_PROFILES_RATE_LIMIT,
      MESSAGING_PROFILES_RATE_LIMIT_WINDOW_MS
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

    const q =
      new URL(request.url).searchParams
        .get("q")
        ?.trim()
        .slice(0, MAX_QUERY_LENGTH) ?? "";
    const profiles = await getMessagingProfiles(
      current,
      current.email,
      MESSAGING_PROFILES_LIMIT,
      q || undefined
    );

    return NextResponse.json({
      items: profiles.map((profile) => ({
        id: profile.id,
        displayName: profile.displayName,
        role: profile.role,
        verified: profile.verified,
      })),
    });
  } catch (err) {
    return jsonError(err, "Could not search profiles");
  }
}
