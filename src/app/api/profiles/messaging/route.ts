import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { checkRateLimit } from "@/lib/rate-limit";
import { getMessagingProfiles } from "@/lib/queries";

import {
  directorySearchQuerySchema,
  queryParamsObject,
} from "@/lib/query-validation";
const MESSAGING_PROFILES_RATE_LIMIT = 30;
const MESSAGING_PROFILES_RATE_LIMIT_WINDOW_MS = 60_000;
const MESSAGING_PROFILES_LIMIT = 20;

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

    const query = directorySearchQuerySchema.parse(
      queryParamsObject(new URL(request.url).searchParams),
    );
    const profiles = await getMessagingProfiles(
      current,
      current.email,
      MESSAGING_PROFILES_LIMIT,
      query.q || undefined
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
