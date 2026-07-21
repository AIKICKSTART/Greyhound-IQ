import { NextResponse } from "next/server";
import { createLiveKitCallToken } from "@/lib/call-token";
import { jsonError } from "@/lib/api-errors";
import { runCommunityFlowProbe } from "@/lib/community-flow-probe";
import { withDbSystemContext } from "@/lib/db-context";
import { requireInternalRequest } from "@/lib/internal-auth";
import { executeScheduledTask } from "@/lib/scheduled-task-control";
import { getSupabaseAdminClient } from "@/lib/supabase-storage";

export async function POST(request: Request) {
  try {
    requireInternalRequest(request);
    const execution = await executeScheduledTask("community-readiness", () =>
      runReadinessChecks(request),
    );
    if (execution.status === "overlap") {
      return NextResponse.json({ ok: true, skipped: "overlap" });
    }

    const { checks, missing } = execution.value;
    return NextResponse.json(
      {
        ok: missing.length === 0,
        checks,
        missing,
        timestamp: new Date().toISOString(),
      },
      { status: missing.length === 0 ? 200 : 503 },
    );
  } catch (err) {
    return jsonError(err, "Could not run community readiness check");
  }
}

async function runReadinessChecks(request: Request) {
    const searchParams = new URL(request.url).searchParams;
    const runWriteProbe = searchParams.get("write") === "true";
    if (searchParams.get("probe") === "livekit") {
      const livekit = await checkLiveKit();
      return {
        checks: { livekit },
        missing: livekit === "ok" ? [] : ["livekit"],
      };
    }

    // The write probe creates real rows; require an explicit env opt-in.
    if (runWriteProbe && process.env.ALLOW_COMMUNITY_WRITE_PROBE !== "true") {
      throw new Error("auth.forbidden");
    }

    const [feedTopics, forumCategories, marketplaceCategories, activeListings] =
      await withDbSystemContext((tx) =>
        Promise.all([
          tx.feedTopic.count({ where: { active: true } }),
          tx.forumCategory.count(),
          tx.marketplaceCategory.count({ where: { active: true } }),
          tx.listing.count({ where: { status: "active" } }),
        ])
      );

    const checks = {
      feedTopics,
      forumCategories,
      marketplaceCategories,
      activeListings,
      realtime: await checkRealtime(),
      livekit: await checkLiveKit(),
      writeFlow: runWriteProbe
        ? await runCommunityFlowProbe({ liveKitMode: "configured" })
        : "skipped",
    };

    const missing = [
      feedTopics < 1 ? "feed_topics" : null,
      forumCategories < 1 ? "forum_categories" : null,
      marketplaceCategories < 1 ? "marketplace_categories" : null,
      checks.realtime !== "ok" ? "realtime" : null,
      checks.livekit !== "ok" ? "livekit" : null,
      typeof checks.writeFlow !== "string" && !checks.writeFlow.ok
        ? "write_flow"
        : null,
    ].filter(Boolean);

  return { checks, missing };
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

async function checkLiveKit() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return "missing";

  try {
    const validateUrl = new URL("/rtc/validate", liveKitHttpUrl(url));
    const unauthenticated = await fetch(validateUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
    });
    if (unauthenticated.status !== 401) {
      return `unauthenticated_${unauthenticated.status}`;
    }

    const signed = await createLiveKitCallToken(
      { profileId: "community-readiness", displayName: "Community Readiness" },
      `community-readiness-${Date.now()}`,
      "voice",
      { url, apiKey, apiSecret },
    );
    const authenticated = await fetch(validateUrl, {
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { authorization: `Bearer ${signed.token}` },
    });
    if (authenticated.status !== 200) {
      return `authenticated_${authenticated.status}`;
    }
    const body = await authenticated.text();
    if (body.trim() !== "success") return "unexpected_response";
  } catch {
    return "unreachable";
  }

  return "ok";
}

function liveKitHttpUrl(value: string) {
  if (value.startsWith("wss://")) return value.replace(/^wss:\/\//u, "https://");
  if (value.startsWith("ws://")) return value.replace(/^ws:\/\//u, "http://");
  return value;
}
