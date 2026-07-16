import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { withDbRequestContext } from "@/lib/db-context";
import { checkRateLimit } from "@/lib/rate-limit";
import { rateLimitExceededResponse } from "@/lib/rate-limit-response";

const MEMORY_DELETE_RATE_LIMIT = 5;
const MEMORY_DELETE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const item = await withDbRequestContext(current, (tx) =>
      tx.memoryEntry.findFirst({
        where: { id, userId: current.dbUserId, deletedAt: null },
      })
    );
    if (!item) throw new Error("memory.not_found");

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not load memory");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const [{ id }, current] = await Promise.all([
      params,
      requireCurrentUserProfile(),
    ]);
    const rateLimit = await checkRateLimit(
      `memory:delete:${current.dbUserId}:${id}`,
      MEMORY_DELETE_RATE_LIMIT,
      MEMORY_DELETE_RATE_LIMIT_WINDOW_MS
    );
    if (!rateLimit.allowed) {
      return rateLimitExceededResponse(
        rateLimit,
        MEMORY_DELETE_RATE_LIMIT,
        { code: "rate_limit.exceeded", message: "Too many requests" }
      );
    }

    const item = await withDbRequestContext(current, async (tx) => {
      const existing = await tx.memoryEntry.findFirst({
        where: { id, userId: current.dbUserId, deletedAt: null },
      });
      if (!existing) return null;
      return tx.memoryEntry.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
    });
    if (!item) throw new Error("memory.not_found");

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete memory");
  }
}
