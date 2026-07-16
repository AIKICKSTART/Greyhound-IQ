import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-errors";
import {
  accountMarketingPreferenceSchema,
  MARKETING_EMAIL_CHANNEL,
} from "@/lib/account-validation";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { requireCurrentUserProfile } from "@/lib/auth";
import { withDbRequestContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const EMAIL_CHANNEL = MARKETING_EMAIL_CHANNEL;
const MARKETING_PREFERENCE_RATE_LIMIT = 20;
const MARKETING_PREFERENCE_RATE_LIMIT_WINDOW_MS = 60_000;

const marketingPreferenceSchema = accountMarketingPreferenceSchema;

function toMarketingPreferenceResponse(preference: { optedIn: boolean } | null) {
  return {
    channel: EMAIL_CHANNEL,
    optedIn: preference?.optedIn ?? false,
  };
}

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const preference = await withDbRequestContext(current, (tx) =>
      tx.marketingPreference.findUnique({
        where: {
          userId_channel: {
            userId: current.dbUserId,
            channel: EMAIL_CHANNEL,
          },
        },
        select: {
          optedIn: true,
        },
      })
    );

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
    const rateLimit = await checkRateLimit(
      `marketing-preference:email:${current.dbUserId}`,
      MARKETING_PREFERENCE_RATE_LIMIT,
      MARKETING_PREFERENCE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MARKETING_PREFERENCE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = marketingPreferenceSchema.parse(
      await readBoundedJsonRequest(request),
    );
    const preference = await withDbRequestContext(current, async (tx) => {
      const updated = await tx.marketingPreference.upsert({
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
      await tx.auditLog.create({
        data: {
          actorId: current.dbUserId,
          actorType: "user",
          action: "marketing_preference.update",
          targetType: "user",
          targetId: current.dbUserId,
          metadata: JSON.stringify({
            channel: EMAIL_CHANNEL,
            optedIn: parsed.optedIn,
          }),
        },
      });
      return updated;
    });

    return NextResponse.json({
      item: toMarketingPreferenceResponse(preference),
    });
  } catch (err) {
    return jsonError(err, "Could not update marketing preference");
  }
}
