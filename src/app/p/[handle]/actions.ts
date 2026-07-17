"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireCurrentUserProfile } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { toggleActorFollow } from "@/lib/social-actor-service";

const followSchema = z.object({
  actorId: z.string().trim().min(1).max(120),
});

export async function toggleActorFollowAction(formData: FormData) {
  const current = await requireCurrentUserProfile();
  const rateLimit = await checkRateLimit(
    `actor:follow:${current.dbUserId}`,
    30,
    60_000,
  );
  if (!rateLimit.allowed) throw new Error("rate_limit.exceeded");

  const parsed = followSchema.parse({
    actorId: formData.get("actorId"),
  });
  const result = await toggleActorFollow(current, parsed.actorId);
  revalidatePath(`/p/${result.handle}`);
}
