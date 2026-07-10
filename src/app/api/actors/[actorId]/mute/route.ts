import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { toggleActorMuteForCurrentUser } from "@/lib/feed-service";
import { checkRateLimit } from "@/lib/rate-limit";

const muteSchema = z.object({
  actorId: z.string().trim().min(1).max(120).optional().nullable(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ actorId: string }> }
) {
  try {
    const [{ actorId }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rate = await checkRateLimit(
      `actor:mute:${current.dbUserId}:${actorId}`,
      30,
      60 * 1000
    );
    if (!rate.allowed) throw new Error("rate_limit.exceeded");
    const raw = await request.text();
    const input = muteSchema.parse(raw ? JSON.parse(raw) : {});
    const item = await toggleActorMuteForCurrentUser(
      current,
      actorId,
      input.actorId
    );
    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not update muted actor");
  }
}
