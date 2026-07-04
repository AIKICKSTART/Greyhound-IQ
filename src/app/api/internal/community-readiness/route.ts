import { NextResponse } from "next/server";
import { createLiveKitCallToken } from "@/lib/call-token";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { requireInternalRequest } from "@/lib/internal-auth";
import { getSupabaseAdminClient } from "@/lib/supabase-storage";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);

    const [feedTopics, forumCategories, marketplaceCategories, activeListings] =
      await Promise.all([
        prisma.feedTopic.count({ where: { active: true } }),
        prisma.forumCategory.count(),
        prisma.marketplaceCategory.count({ where: { active: true } }),
        prisma.listing.count({ where: { status: "active" } }),
      ]);

    const checks = {
      feedTopics,
      forumCategories,
      marketplaceCategories,
      activeListings,
      realtime: await checkRealtime(),
      livekit: checkLiveKit(),
    };

    const missing = [
      feedTopics < 1 ? "feed_topics" : null,
      forumCategories < 1 ? "forum_categories" : null,
      marketplaceCategories < 1 ? "marketplace_categories" : null,
      checks.realtime !== "ok" ? "realtime" : null,
      checks.livekit !== "ok" ? "livekit" : null,
    ].filter(Boolean);

    return NextResponse.json(
      {
        ok: missing.length === 0,
        checks,
        missing,
        timestamp: new Date().toISOString(),
      },
      { status: missing.length === 0 ? 200 : 503 }
    );
  } catch (err) {
    return jsonError(err, "Could not run community readiness check");
  }
}

async function checkRealtime() {
  const client = getSupabaseAdminClient();
  const channel = client.channel("internal:community-readiness");
  try {
    await channel.httpSend("probe", { timestamp: Date.now() });
    return "ok";
  } finally {
    await client.removeChannel(channel);
  }
}

function checkLiveKit() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return "missing";

  createLiveKitCallToken(
    { profileId: "community-readiness", displayName: "Community Readiness" },
    "community-readiness",
    { url, apiKey, apiSecret }
  );
  return "ok";
}
