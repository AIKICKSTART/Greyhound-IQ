import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { readBoundedJsonRequest } from "@/lib/json-request";
import { withDbRequestContext } from "@/lib/db-context";
import { memorySupersedeSchema } from "@/lib/memory-validation";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const MEMORY_SUPERSEDE_RATE_LIMIT = 5;
const MEMORY_SUPERSEDE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

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
      `memory:supersede:${current.dbUserId}:${id}`,
      MEMORY_SUPERSEDE_RATE_LIMIT,
      MEMORY_SUPERSEDE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEMORY_SUPERSEDE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const parsed = memorySupersedeSchema.parse(await readBoundedJsonRequest(request));
    const item = await withDbRequestContext(current, async (tx) => {
      const existing = await tx.memoryEntry.findFirst({
        where: { id, userId: current.dbUserId, deletedAt: null },
      });
      if (!existing) throw new Error("memory.not_found");

      const replacement = parsed.replacementContent
        ? await tx.memoryEntry.create({
            data: {
              userId: current.dbUserId,
              kind: existing.kind,
              content: parsed.replacementContent,
              source: "explicit_user_input",
              sourceRef: existing.id,
              importance: existing.importance,
            },
          })
        : null;

      const supersededById = parsed.supersededById ?? replacement?.id;
      if (!supersededById) throw new Error("memory.replacement_required");

      return tx.memoryEntry.update({
        where: { id: existing.id },
        data: {
          supersededById,
          supersededAt: new Date(),
        },
      });
    });

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not supersede memory");
  }
}
