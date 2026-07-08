import { NextResponse } from "next/server";
import { dogOwnershipClaimSchema } from "@/lib/account-validation";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { withDbRequestContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";

const DOG_CLAIM_RATE_LIMIT = 3;
const DOG_CLAIM_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `dog:claim:${current.dbUserId}:${id}`,
      DOG_CLAIM_RATE_LIMIT,
      DOG_CLAIM_RATE_LIMIT_WINDOW_MS
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

    const parsed = dogOwnershipClaimSchema.parse(await request.json());

    const ownership = await withDbRequestContext(current, async (tx) => {
      const dog = await tx.dog.findUnique({ where: { id } });
      if (!dog) throw new Error("dog.not_found");

      return tx.dogOwnership.upsert({
        where: {
          dogId_profileId: {
            dogId: dog.id,
            profileId: current.profileId,
          },
        },
        update: {
          role: parsed.role,
        },
        create: {
          dogId: dog.id,
          profileId: current.profileId,
          role: parsed.role,
          verified: false,
        },
        include: {
          dog: {
            select: {
              id: true,
              name: true,
            },
          },
          profile: true,
        },
      });
    });

    return NextResponse.json({ item: ownership }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not claim dog");
  }
}
