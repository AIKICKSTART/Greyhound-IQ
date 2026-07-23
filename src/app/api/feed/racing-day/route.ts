import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { withDbRequestContext } from "@/lib/db-context";
import { feedRacingDaySchema } from "@/lib/feed-validation";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

// Persists the signed-in user's "My racing day" track selection on their
// profile. Stored as a JSON id array; an empty array means "all meetings".
export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rate = await checkRateLimit(
      `feed:racing-day:${current.dbUserId}`,
      20,
      60 * 1000,
      { failClosed: true },
    );
    if (!rate.allowed) {
      return rateLimitExceededResponse(rate, 20, {
        code: "rate_limit.exceeded",
        message: "rate_limit.exceeded",
      });
    }
    const { trackIds } = feedRacingDaySchema.parse(
      await readBoundedJsonRequest(request),
    );
    await withDbRequestContext(current, (tx) =>
      tx.profile.update({
        where: { id: current.profileId },
        data: { racingDayTrackIds: JSON.stringify(trackIds) },
      }),
    );
    return NextResponse.json({ item: { trackIds } });
  } catch (err) {
    return jsonError(err, "Could not update your racing day");
  }
}
