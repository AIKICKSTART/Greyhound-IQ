import { NextResponse } from "next/server";
import { z } from "zod";
import { jsonError } from "@/lib/api-errors";
import { requireCurrentUserProfile } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const EMAIL_CHANNEL = "email";
const MARKETING_PREFERENCE_RATE_LIMIT = 20;
const MARKETING_PREFERENCE_RATE_LIMIT_WINDOW_MS = 60_000;

const marketingPreferenceSchema = z.object({
  channel: z.literal(EMAIL_CHANNEL).optional(),
  optedIn: z.boolean(),
});

function toMarketingPreferenceResponse(preference: { optedIn: boolean } | null) {
  return {
    channel: EMAIL_CHANNEL,
    optedIn: preference?.optedIn ?? false,
  };
}

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const preference = await prisma.marketingPreference.findUnique({
      where: {
        userId_channel: {
          userId: current.dbUserId,
          channel: EMAIL_CHANNEL,
        },
      },
      select: {
        optedIn: true,
      },
    });

    return NextResponse.json({
      item: toMarketingPreferenceResponse(preference),
    });
  } catch (err) {
    return jsonError(err, "Could not load marketing preference");
  }
}

export async function POST(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = checkRateLimit(
      `marketing-preference:email:${current.dbUserId}`,
      MARKETING_PREFERENCE_RATE_LIMIT,
      MARKETING_PREFERENCE_RATE_LIMIT_WINDOW_MS
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

    const parsed = marketingPreferenceSchema.parse(await request.json());
    const preference = await prisma.marketingPreference.upsert({
      where: {
        userId_channel: {
          userId: current.dbUserId,
          channel: EMAIL_CHANNEL,
        },
      },
      create: {
        userId: current.dbUserId,
        channel: EMAIL_CHANNEL,
        optedIn: parsed.optedIn,
      },
      update: {
        optedIn: parsed.optedIn,
      },
      select: {
        optedIn: true,
      },
    });

    return NextResponse.json({
      item: toMarketingPreferenceResponse(preference),
    });
  } catch (err) {
    return jsonError(err, "Could not update marketing preference");
  }
}
