import { NextResponse } from "next/server";
import { requireCurrentUserProfile } from "@/lib/auth";
import { jsonError } from "@/lib/api-errors";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

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
    const item = await prisma.memoryEntry.findFirst({
      where: { id, userId: current.dbUserId, deletedAt: null },
    });
    if (!item) throw new Error("memory.not_found");

    await prisma.memoryEntry.update({
      where: { id: item.id },
      data: { lastAccessedAt: new Date(), accessCount: { increment: 1 } },
    });

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
    const rateLimit = checkRateLimit(
      `memory:delete:${current.dbUserId}:${id}`,
      MEMORY_DELETE_RATE_LIMIT,
      MEMORY_DELETE_RATE_LIMIT_WINDOW_MS
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

    const existing = await prisma.memoryEntry.findFirst({
      where: { id, userId: current.dbUserId, deletedAt: null },
    });
    if (!existing) throw new Error("memory.not_found");

    const item = await prisma.memoryEntry.update({
      where: { id: existing.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ item });
  } catch (err) {
    return jsonError(err, "Could not delete memory");
  }
}
