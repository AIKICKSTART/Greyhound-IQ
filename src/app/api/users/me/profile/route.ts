import { NextResponse } from "next/server";
import {
  hasProfileMarketingFields,
  profileUpdateSchema,
} from "@/lib/account-validation";
import { assertPaidFeatureAccess, hasTier, requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { withDbRequestContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";

const PROFILE_UPDATE_RATE_LIMIT = 10;
const PROFILE_UPDATE_RATE_LIMIT_WINDOW_MS = 60 * 1000;

export async function GET() {
  try {
    const current = await requireCurrentUserProfile();
    const profile = await prisma.profile.findUnique({
      where: { id: current.profileId },
      include: {
        dogsOwned: {
          orderBy: [{ verified: "desc" }, { createdAt: "desc" }],
          include: {
            dog: {
              select: {
                id: true,
                name: true,
                sex: true,
                colour: true,
              },
            },
          },
        },
        _count: {
          select: {
            listings: true,
            threads: true,
            posts: true,
            dogsOwned: true,
          },
        },
      },
    });

    return NextResponse.json({ item: profile });
  } catch (err) {
    return jsonError(err, "Could not load profile");
  }
}

export async function PATCH(request: Request) {
  try {
    const current = await requireCurrentUserProfile();
    const rateLimit = await checkRateLimit(
      `profile:update:${current.dbUserId}`,
      PROFILE_UPDATE_RATE_LIMIT,
      PROFILE_UPDATE_RATE_LIMIT_WINDOW_MS
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

    const parsed = profileUpdateSchema.parse(await request.json());
    if (hasProfileMarketingFields(parsed)) assertPaidFeatureAccess(current);
    const data = hasTier(current.tier, "pro")
      ? parsed
      : {
          displayName: parsed.displayName,
          bio: parsed.bio,
          state: parsed.state,
        };

    const profile = await withDbRequestContext(current, (tx) => tx.profile.update({
      where: { id: current.profileId },
      data,
    }));

    return NextResponse.json({ item: profile });
  } catch (err) {
    return jsonError(err, "Could not update profile");
  }
}
