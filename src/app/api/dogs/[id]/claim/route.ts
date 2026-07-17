import { NextResponse } from "next/server";
import { dogOwnershipClaimSchema } from "@/lib/account-validation";
import { createAuditLog } from "@/lib/account-service";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { withDbRequestContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const DOG_CLAIM_RATE_LIMIT = 5;
const DOG_CLAIM_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
      `dog:claim:${current.dbUserId}`,
      DOG_CLAIM_RATE_LIMIT,
      DOG_CLAIM_RATE_LIMIT_WINDOW_MS,
      { failClosed: true },
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        DOG_CLAIM_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = dogOwnershipClaimSchema.parse(await readBoundedJsonRequest(request));

    const ownership = await withDbRequestContext(current, async (tx) => {
      const dog = await tx.dog.findUnique({
        where: { id },
        select: { id: true },
      });
      if (!dog) throw new Error("dog.not_found");

      // One claim per (dog, profile); a re-claim must not reset an existing
      // review, so reject the duplicate rather than upserting.
      const existing = await tx.dogOwnership.findUnique({
        where: {
          dogId_profileId: { dogId: dog.id, profileId: current.profileId },
        },
        select: { id: true },
      });
      if (existing) throw new Error("dog.ownership.already_claimed");

      const created = await tx.dogOwnership.create({
        data: {
          dogId: dog.id,
          profileId: current.profileId,
          role: parsed.role,
          evidence: parsed.evidence,
          status: "pending",
          verified: false,
        },
      });

      await createAuditLog({
        actorId: current.dbUserId,
        actorType: "user",
        action: "dog.ownership.claim",
        targetType: "dogOwnership",
        targetId: created.id,
        metadata: { dogId: dog.id, role: parsed.role },
      });

      return created;
    });

    return NextResponse.json({ item: ownership }, { status: 201 });
  } catch (err) {
    return jsonError(err, "Could not claim dog");
  }
}
